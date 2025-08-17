import { bot } from '../../botInstance.js';
import { Ticket } from '../../../models/Event.js';
import { UserTicket } from '../../../models/UserTicket.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.beget.com',
    port: 465,
    secure: true,
    auth: {
        user: 'ibra001@ibrokhim.ru',
        pass: 'Restart%1996'
    }
});

const ADMIN_EMAIL = 'ibra001@ibrokhim.ru';

export class AdminNotificationsHandler {
    constructor() {
        // Обработчики будут установлены в основном setupAdminHandlers
    }

    async showRefundTypeSelection(chatId) {
        await bot.sendMessage(
            chatId,
            '📢 *Выберите тип уведомления:*',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Отмена мероприятия', callback_data: 'refund_type_cancel' },
                            { text: 'Перенос мероприятия', callback_data: 'refund_type_reschedule' }
                        ],
                        [{ text: '◀️ Назад', callback_data: 'back_to_command_menu' }]
                    ]
                }
            }
        );
    }

    async showAllEventsForRefund(chatId, refundType) {
        try {
            const events = await Ticket.findAll({
                include: [{
                    model: UserTicket,
                    as: 'user_tickets',
                    where: { 
                        payment_status: 'paid'
                    },
                    required: true
                }],
                order: [['event_date', 'DESC']]
            });

            if (!events.length) {
                return await bot.sendMessage(chatId, '❌ Нет мероприятий с оплаченными билетами', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '◀️ Назад', callback_data: 'admin_refund' }]
                        ]
                    }
                });
            }

            const actionText = refundType === 'cancel' ? 'отмены' : 'переноса';

            const eventButtons = events.map(event => [
                {
                    text: `${event.title} (${event.user_tickets.length} билетов)`,
                    callback_data: `full_refund_event_${event.id}_${refundType}`
                }
            ]);

            eventButtons.push([{ text: '◀️ Назад', callback_data: 'admin_refund' }]);

            await bot.sendMessage(
                chatId,
                `🎪 *Выберите мероприятие для ${actionText}:*\n\n` +
                `ℹ️ Будут отправлены уведомления всем покупателям`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: eventButtons
                    }
                }
            );

        } catch (error) {
            console.error('Error showing events for refund:', error);
            await bot.sendMessage(chatId, '⚠️ Ошибка при загрузке мероприятий');
        }
    }

    async confirmFullRefund(chatId, eventId, refundType, messageId) {
        try {
            const event = await Ticket.findByPk(eventId, {
                include: [{
                    model: UserTicket,
                    as: 'user_tickets',
                    where: { 
                        payment_status: 'paid'
                    },
                    include: [{
                        association: 'order_item',
                        required: true,
                        include: [{
                            association: 'order',
                            required: true
                        }]
                    }]
                }]
            });

            if (!event) {
                return await bot.sendMessage(chatId, '❌ Мероприятие не найдено');
            }

            // Рассчитываем общее количество билетов и сумму
            let totalTickets = 0;
            let totalAmount = 0;
            
            event.user_tickets.forEach(ticket => {
                const quantity = ticket.order_item.quantity || 1;
                totalTickets += quantity;
                totalAmount += parseFloat(event.price) * quantity;
            });

            const actionText = refundType === 'cancel' ? 'ОТМЕНЫ' : 'ПЕРЕНОСА';
            const actionDescription = refundType === 'cancel' ? 'отменено' : 'перенесено';

            const ticketPrice = parseFloat(event.price).toFixed(2);
            const formattedTotalAmount = totalAmount.toFixed(2);
            
            const eventDate = new Date(event.event_date);
            const isPastEvent = eventDate < new Date();

            await bot.editMessageText(
                `⚠️ *ПОДТВЕРЖДЕНИЕ ${actionText} МЕРОПРИЯТИЯ* ⚠️\n\n` +
                `📌 *${event.title}*\n` +
                `📅 Дата мероприятия: ${eventDate.toLocaleString()}\n` +
                `🎫 Количество билетов: ${totalTickets}\n` +
                `💰 Стоимость билета: ${ticketPrice} ₽\n` +
                `💰 Общая сумма: ${formattedTotalAmount} ₽\n` +
                `📌 Статус: ${isPastEvent ? '🔴 Прошедшее' : '🟢 Будущее'}\n\n` +
                `*Это действие нельзя отменить! Все покупатели получат уведомление о том, что мероприятие ${actionDescription}.*`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { 
                                    text: `✅ ПОДТВЕРДИТЬ ${actionText}`, 
                                    callback_data: `confirm_full_refund_${eventId}_${refundType}`
                                }
                            ],
                            [
                                { 
                                    text: '❌ ОТМЕНА', 
                                    callback_data: 'cancel_full_refund'
                                }
                            ]
                        ]
                    }
                }
            );

        } catch (error) {
            console.error('Confirm refund error:', error);
            await bot.sendMessage(chatId, '⚠️ Ошибка при подтверждении');
        }
    }

    async processFullRefund(chatId, eventId, refundType, messageId) {
        try {
            const actionText = refundType === 'cancel' ? 'отмены' : 'переноса';
            
            await bot.editMessageText(`🔄 *Отправка уведомлений о ${actionText} мероприятия...*`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [] }
            });

            // Получаем все билеты с полной информацией о заказе
            const tickets = await UserTicket.findAll({
                where: {
                    ticket_id: eventId,
                    payment_status: 'paid'
                },
                include: [
                    {
                        association: 'ticket',
                        attributes: ['title', 'event_date', 'price']
                    },
                    {
                        association: 'order_item',
                        required: true,
                        include: [{
                            association: 'order',
                            required: true
                        }]
                    }
                ]
            });

            if (!tickets.length) {
                return await bot.editMessageText(
                    '❌ Нет оплаченных билетов с полной информацией о заказе',
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '◀️ В меню возвратов', callback_data: 'admin_refund' }]
                            ]
                        }
                    }
                );
            }

            const event = tickets[0].ticket;
            const eventDate = new Date(event.event_date);
            const formattedDate = eventDate.toLocaleString('ru-RU');

            // Отправляем уведомления
            const results = await Promise.all(
                tickets.map(ticket => this.sendRefundNotification(ticket, event, refundType))
            );

            console.log(results, 'res')

            const successCount = results.filter(r => r.success).length;
            const failedCount = results.length - successCount;

            // Формируем email отчет для администратора
            let totalRefundAmount = 0;
            let adminEmailSubject = `Отчет о возврате: ${event.title}`;
            let adminEmailText = `Детали возврата средств\n\n` +
                            `Мероприятие: ${event.title}\n` +
                            `Дата: ${formattedDate}\n\n` +
                            `Список покупателей:\n\n`;

            results.forEach(result => {
                if (result.success) {
                    adminEmailText += `Покупатель: ${result.customerName}\n` +
                                `Билетов: ${result.ticketCount}\n` +
                                `Номера билетов: ${result.ticketNumbers}\n` +
                                `Стоимость одного билета: ${event.price} ₽\n` +
                                `Сумма: ${result.amount} ₽\n` +
                                `Email: ${result.email}\n` +
                                `Телефон: ${result.phone}\n\n`;
                                totalRefundAmount += parseFloat(result.amount) || 0;
                }
            });

            adminEmailText += `Успешно отправлено: ${successCount} уведомлений\n` +
                        `Не удалось отправить: ${failedCount}\n` +
                        `Общая сумма к возврату: ${totalRefundAmount.toFixed(2)} ₽`;

            // Отправляем email администратору
            await this.sendEmail(ADMIN_EMAIL, adminEmailSubject, adminEmailText);

            await bot.editMessageText(
                `✅ *УВЕДОМЛЕНИЯ О ${actionText.toUpperCase()} УСПЕШНО ОТПРАВЛЕНЫ*\n\n` +
                `📌 Мероприятие: ${event.title}\n` +
                `📩 Отправлено уведомлений: ${successCount}\n` +
                `💰 Общая сумма к возврату: ${totalRefundAmount.toFixed(2)} ₽\n\n` +
                `Покупатели получили инструкции по оформлению возврата.`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '◀️ В меню возвратов', callback_data: 'admin_refund' }]
                        ]
                    }
                }
            );

        } catch (error) {
            console.error('Process refund error:', error);
            await bot.editMessageText(
                '⚠️ *ОШИБКА ОТПРАВКИ УВЕДОМЛЕНИЙ*\n\n' +
                'При отправке уведомлений произошла ошибка. Пожалуйста, попробуйте позже или проверьте логи системы.\n\n' +
                `Ошибка: ${error.message}`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '◀️ В меню возвратов', callback_data: 'admin_refund' }]
                        ]
                    }
                }
            );
        }
    }

    async sendRefundNotification(userTicket, event, refundType) {
        try {
            if (!userTicket.order_item || !userTicket.order_item.order) {
                throw new Error(`Не найдена информация о заказе для билета ${userTicket.ticket_number}`);
            }

            const order = userTicket.order_item.order;
            const quantity = userTicket.order_item.quantity || 1;
            const ticketPrice = parseFloat(event.price).toFixed(2);
            const totalAmount = (parseFloat(event.price) * quantity).toFixed(2);
            
            if (!order.first_name || !order.last_name || !order.email || !order.phone) {
                throw new Error(`Неполные данные заказа для билета ${userTicket.ticket_number}`);
            }

            const allTickets = await UserTicket.findAll({
                include: [{
                    association: 'order_item',
                    where: {
                        order_id: order.id
                    },
                    required: true
                }],
                where: {
                    payment_status: 'paid'
                },
                attributes: ['ticket_number']
            });

            const allTicketNumbers = allTickets.map(t => t.ticket_number).join(', ');

            const eventDate = new Date(event.event_date);
            const formattedDate = eventDate.toLocaleString('ru-RU');

            // Уведомление для покупателя
            let emailSubject, emailText, telegramText;

            if (refundType === 'cancel') {
                emailSubject = `Отмена мероприятия "${event.title}"`;
                emailText = `Уважаемый(ая) ${order.last_name} ${order.first_name},\n\nК сожалению, мероприятие "${event.title}", запланированное на ${formattedDate}, отменено.\n\nДетали вашего заказа:\n- Количество билетов: ${quantity}\n- Номера билетов: ${allTicketNumbers}\n- Стоимость одного билета: ${ticketPrice} ₽\n- Общая сумма к возврату: ${totalAmount} ₽\n\nДля оформления возврата:\n1. Ответьте на это письмо\n2. Укажите реквизиты банковской карты для возврата\n3. Подтвердите номера билетов: ${allTicketNumbers}\n\nС уважением,\nРазвлекательный комплекс "Француз"`;
                
                telegramText = `🔴 *Уведомление об отмене мероприятия*\n\n` +
                               `Мероприятие "${event.title}" (${formattedDate}) отменено.\n\n` +
                               `Ваши билеты:\n` +
                               `🎫 Номера: ${allTicketNumbers}\n` +
                               `💰 Сумма к возврату: ${totalAmount} ₽\n\n` +
                               `Для возврата средств ответьте на это сообщение с реквизитами банковской карты.`;
            } else {
                emailSubject = `Перенос мероприятия "${event.title}"`;
                emailText = `Уважаемый(ая) ${order.last_name} ${order.first_name},\n\nМероприятие "${event.title}", запланированное на ${formattedDate}, перенесено.\n\nДетали вашего заказа:\n- Количество билетов: ${quantity}\n- Номера билетов: ${allTicketNumbers}\n- Стоимость одного билета: ${ticketPrice} ₽\n- Общая сумма к возврату: ${totalAmount} ₽\n\nВы можете:\n1. Сохранить билеты для новой даты\n2. Или оформить возврат средств\n\nДля возврата:\n1. Ответьте на это письмо\n2. Укажите реквизиты банковской карты\n3. Подтвердите номера билетов: ${allTicketNumbers}\n\nС уважением,\nРазвлекательный комплекс "Француз"`;
                
                telegramText = `🟡 *Уведомление о переносе мероприятия*\n\n` +
                               `Мероприятие "${event.title}" (${formattedDate}) перенесено.\n\n` +
                               `Ваши билеты:\n` +
                               `🎫 Номера: ${allTicketNumbers}\n` +
                               `💰 Сумма к возврату: ${totalAmount} ₽\n\n` +
                               `Вы можете сохранить билеты или оформить возврат. Для возврата напишите нам на электронную почту ${ADMIN_EMAIL} реквизиты банковской карты и номера билетов.`;
            }

            // Отправляем email
            await this.sendEmail(order.email, emailSubject, emailText);
            
            // Отправляем Telegram уведомление вместо SMS
            try {
                await bot.sendMessage(
                    order.user_id, // предполагаем, что user_id хранится в заказе
                    telegramText,
                    { parse_mode: 'Markdown' }
                );
            } catch (tgError) {
                console.error('Ошибка отправки Telegram уведомления:', tgError);
                // Если не удалось отправить в Telegram, пробуем отправить email с текстом для Telegram
                await this.sendEmail(
                    order.email, 
                    emailSubject, 
                    emailText + `\n\nTelegram уведомление:\n${telegramText.replace(/\*/g, '')}`
                );
            }

            return { 
                success: true,
                customerName: `${order.last_name} ${order.first_name}`,
                ticketCount: quantity,
                amount: totalAmount,
                email: order.email,
                phone: order.phone,
                ticketNumbers: allTicketNumbers
            };

        } catch (error) {
            console.error(`Ошибка отправки уведомления для билета ${userTicket.ticket_number}:`, error);
            return {
                success: false,
                error: error.message,
                ticketNumber: userTicket.ticket_number
            };
        }
    }

    async sendEmail(to, subject, text) {
        try {
            const mailOptions = {
                from: 'ibra001@ibrokhim.ru',
                to,
                subject,
                text,
                replyTo: ADMIN_EMAIL
            };

            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }
}

export const adminNotificationsHandler = new AdminNotificationsHandler();