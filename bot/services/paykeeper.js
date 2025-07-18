import axios from 'axios';
import dotenv from 'dotenv';
import { URLSearchParams } from 'url';
import base64 from 'base-64';
import { sendUserTicketEmail, sendAdminNotification } from './emailService.js';
import TicketService from './ticketService.js'

dotenv.config();

const PAYKEEPER_USER = process.env.PAYKEEPER_USER;
const PAYKEEPER_PASSWORD = process.env.PAYKEEPER_PASSWORD;
const PAYKEEPER_SERVER = process.env.PAYKEEPER_SERVER?.replace(/\/$/, '');

if (!PAYKEEPER_USER || !PAYKEEPER_PASSWORD || !PAYKEEPER_SERVER) {
    console.error('Ошибка: Не настроены переменные PayKeeper в .env файле');
    process.exit(1);
}

const authString = `${PAYKEEPER_USER}:${PAYKEEPER_PASSWORD}`;
const base64Auth = base64.encode(authString);

const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${base64Auth}`
};

export const initializePaymentSystem = async () => {
    console.log('Попытка подключения к PayKeeper...');

    try {
        const testUrl = `${PAYKEEPER_SERVER}/info/`;
        const response = await axios.get(testUrl, {
            headers,
            timeout: 5000
        });

        if (response.data && response.data.status === 'ok') {
            console.log('Успешное подключение к PayKeeper');
            return true;
        }
        throw new Error('Некорректный ответ от PayKeeper');
    } catch (error) {
        console.error('Ошибка подключения к PayKeeper:', error.message);
        return false;
    }
};

export const processPayment = async (bot, chatId, ticketData) => {
    if (!ticketData?.customer?.first_name || !ticketData?.customer?.last_name) {
        throw new Error('Не указано имя или фамилия покупателя');
    }
    try {
        const tokenResponse = await axios.post(
            `${PAYKEEPER_SERVER}/info/settings/token/`,
            {},
            { headers, timeout: 10000 }
        );

        const token = tokenResponse.data?.token;
        if (!token) throw new Error('Не получен токен от PayKeeper');
        const customerName = `${ticketData.customer.first_name} ${ticketData.customer.last_name}`.trim();

        const paymentParams = new URLSearchParams();
        paymentParams.append('pay_amount', ticketData.price);
        paymentParams.append('clientid', customerName.substring(0, 100));
        paymentParams.append('orderid', ticketData.number);
        paymentParams.append('service_name', `Билет: ${ticketData.event.title}`.substring(0, 100));
        paymentParams.append('client_email', ticketData.customer.email);
        paymentParams.append('client_phone', ticketData.customer.phone);
        paymentParams.append('token', token);
        paymentParams.append('payment_currency', 'RUB');
        paymentParams.append('payment_details', `Билет №${ticketData.number}`);

        const invoiceResponse = await axios.post(
            `${PAYKEEPER_SERVER}/change/invoice/preview/`,
            paymentParams,
            { headers, timeout: 15000 }
        );

        const invoiceId = invoiceResponse.data?.invoice_id;
        if (!invoiceId) throw new Error('Не получен ID счета');

        const paymentUrl = `${PAYKEEPER_SERVER}/bill/${invoiceId}/`;
        
        await bot.sendMessage(
            chatId,
            `🎟️ *Билет №${ticketData.number}*\n\n` +
            `🎭 *${ticketData.event.title}*\n` +
            `📅 ${ticketData.event.date} в ${ticketData.event.time}\n` +
            `📍 ${ticketData.event.location}\n` +
            `💰 *${ticketData.price} руб.*\n\n` +
            `Для оплаты нажмите кнопку "Оплатить" ниже\n\n` +
            `После оплаты нажмите кнопку "Проверить оплату"`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 Оплатить', url: paymentUrl }],
                        [{ text: '🔄 Проверить оплату', callback_data: `check_payment_${invoiceId}` }],
                        [{ text: '❌ Отменить', callback_data: 'cancel_payment' }]
                    ]
                }
            }

        );

        return { success: true, invoiceId };

    } catch (error) {
        console.error('Ошибка создания платежа:', error);
        await bot.sendMessage(
            chatId,
            '⚠️ *Ошибка при создании платежа*\n\n' +
            'Мы не смогли сгенерировать платежную ссылку.\n' +
            'Пожалуйста, попробуйте позже или обратитесь в поддержку:\n' +
            '📞 +7(968)090-55-50',
            { parse_mode: 'Markdown' }
        );
        return { success: false, error: error.message };
    }
};

export const checkPaymentStatus = async (bot, chatId, invoiceId) => {
    try {
        const response = await axios.get(
            `${PAYKEEPER_SERVER}/info/invoice/status/?id=${invoiceId}`,
            { headers, timeout: 10000 }
        );

        const status = response.data?.status;

        if (status === 'paid') {
            const userState = userStates[chatId];

            const ticketData = {
                number: `FR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                event: userState.eventData,
                customer: {
                    name: userState.name,
                    phone: userState.phone,
                    email: userState.email,
                },
                price: userState.eventData.price,
                invoiceId: invoiceId
            };

            await TicketService.confirmPayment(invoiceId);

            // Отправка email пользователю
            await sendUserTicketEmail(userState.email, ticketData);

            // Отправка уведомления администратору
            await sendAdminNotification('zakaz@dali-khinkali.ru', ticketData);

            await bot.sendMessage(
                chatId,
                '✅ *Оплата подтверждена!*\n\n' +
                'Ваш билет успешно оплачен. На ваш email (' + userState.email + ') отправлено подтверждение с билетом.\n\n' +
                'При возникновении вопросов звоните:\n' +
                '📞 +7(968)090-55-50',
                { parse_mode: 'Markdown' }
            );
        } else {
            await bot.sendMessage(
                chatId,
                '⚠️ *Оплата не найдена*\n\n' +
                'Мы еще не получили подтверждение оплаты.\n' +
                'Если вы уже оплатили, пожалуйста, подождите несколько минут и проверьте снова.',
                { parse_mode: 'Markdown' }
            );
        }
    } catch (error) {
        console.error('Ошибка проверки статуса платежа:', error);
        await bot.sendMessage(
            chatId,
            '⚠️ *Ошибка проверки платежа*\n\n' +
            'Не удалось проверить статус оплаты. Пожалуйста, попробуйте позже или обратитесь в поддержку.',
            { parse_mode: 'Markdown' }
        );
    }
};
