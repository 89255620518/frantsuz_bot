import { bot } from '../botInstance.js';
import { UserTicket } from '../../models/UserTicket.js';
import { Ticket } from '../../models/Event.js';
import { Order } from '../../models/Orders.js';
import { OrderItem } from '../../models/OrderItem.js';
import { User } from '../../models/User.js';
import { formatDate } from '../../services/dateFormatters.js';

export const setupQRScanner = () => {
    console.log('🔍 Инициализация сканера QR-кодов...');

    bot.on('callback_query', async (callbackQuery) => {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;

        if (data.startsWith('mark_used_')) {
            await handleMarkUsed(callbackQuery, chatId, data);
        }
    });
};

export async function processTicket(chatId, ticketNumber) {
    try {
        const userTicket = await UserTicket.findOne({
            where: { ticket_number: ticketNumber },
            include: [
                {
                    model: Ticket,
                    as: 'ticket',
                    attributes: ['title', 'description', 'image_url', 'event_date', 'event_location', 'price']
                },
                {
                    model: OrderItem,
                    as: 'order_item',
                    required: false, // Разрешаем отсутствие связи
                    include: [{
                        model: Order,
                        as: 'order',
                        required: false, // Разрешаем отсутствие связи
                        attributes: ['first_name', 'last_name', 'email', 'phone', 'status']
                    }]
                }
            ]
        });

        if (!userTicket) {
            return bot.sendMessage(chatId, '❌ Билет не найден. Пожалуйста, проверьте правильность кода.');
        }

        const user = await User.findOne({ where: { telegram_id: chatId } });
        const isAdmin = user?.is_admin || false;

        const message = buildTicketMessage(userTicket);
        const options = { parse_mode: 'Markdown' };

        if (isAdmin && !userTicket.is_used) {
            options.reply_markup = {
                inline_keyboard: [
                    [{
                        text: '✅ Отметить как использованный',
                        callback_data: `mark_used_${userTicket.id}`
                    }]
                ]
            };
        }

        if (userTicket.ticket.image_url) {
            await bot.sendPhoto(chatId, userTicket.ticket.image_url, {
                caption: message,
                ...options
            });
        } else {
            await bot.sendMessage(chatId, message, options);
        }
    } catch (error) {
        console.error('Ошибка обработки билета:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при проверке билета. Попробуйте позже.');
    }
}

function buildTicketMessage(userTicket) {
    let buyerInfo = '';
    
    // Если есть информация о заказе
    if (userTicket.order_item && userTicket.order_item.order) {
        const order = userTicket.order_item.order;
        buyerInfo = `👤 *Данные покупателя:*\n` +
                   `• Имя: ${order.first_name || 'Не указано'} ${order.last_name || 'Не указано'}\n` +
                   `• Email: ${order.email || 'Не указан'}\n` +
                   `• Телефон: ${order.phone || 'Не указан'}\n\n`;
    } else {
        buyerInfo = 'ℹ️ Информация о заказе отсутствует\n\n';
    }

    return `🎟️ *Информация о билете* 🎟️\n\n` +
           `📌 *Номер билета:* ${userTicket.ticket_number}\n` +
           `📌 *Мероприятие:* ${userTicket.ticket.title}\n` +
           `📅 *Дата:* ${formatDate(userTicket.ticket.event_date)}\n` +
           `📍 *Место:* ${userTicket.ticket.event_location}\n` +
           `💰 *Стоимость:* ${userTicket.ticket.price} руб.\n\n` +
           buyerInfo +
           `🔄 *Статус оплаты:* ${userTicket.payment_status === 'paid' ? '✅ Оплачен' : '❌ Не оплачен'}\n` +
           `🎭 *Статус билета:* ${userTicket.is_used ? '❌ Использован' : '✅ Активен'}`;
}

async function handleMarkUsed(callbackQuery, chatId, data) {
    try {
        const ticketId = data.split('_')[2];
        const userTicket = await UserTicket.findByPk(ticketId);

        if (!userTicket) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: 'Билет не найден' });
        }

        const user = await User.findOne({ where: { telegram_id: chatId } });
        if (!user?.is_admin) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: 'Недостаточно прав' });
        }

        await userTicket.update({ is_used: true, used_at: new Date() });

        await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: callbackQuery.message.message_id }
        );

        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Билет отмечен как использованный' });
        await bot.sendMessage(chatId, '✅ Билет успешно отмечен как использованный.');
    } catch (error) {
        console.error('Ошибка при отметке билета:', error);
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Произошла ошибка' });
    }
}