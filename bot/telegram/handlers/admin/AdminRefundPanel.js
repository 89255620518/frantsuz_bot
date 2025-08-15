// AdminRefundHandler.js
import { bot } from '../../botInstance.js';
import { Ticket } from '../../../models/Event.js';
import { UserTicket } from '../../../models/UserTicket.js';
import RefundService from '../../../services/RefundService.js';

const refundService = new RefundService();

export class AdminRefundHandler {
    constructor() {
        this.setupHandlers();
    }

    setupHandlers() {
        bot.on('callback_query', async (callbackQuery) => {
            const data = callbackQuery.data;
            const chatId = callbackQuery.message.chat.id;
            
            if (data === 'admin_refund') {
                await this.showAllEventsForRefund(chatId);
            } else if (data.startsWith('full_refund_event_')) {
                const eventId = data.split('_')[3];
                await this.confirmFullRefund(chatId, eventId, callbackQuery.message.message_id);
            } else if (data.startsWith('confirm_full_refund_')) {
                const eventId = data.split('_')[3];
                await this.processFullRefund(chatId, eventId, callbackQuery.message.message_id);
            } else if (data === 'cancel_full_refund') {
                await bot.deleteMessage(chatId, callbackQuery.message.message_id);
            }
        });
    }

    async showAllEventsForRefund(chatId) {
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
                            [{ text: '◀️ Назад', callback_data: 'back_to_command_menu' }]
                        ]
                    }
                });
            }

            const eventButtons = events.map(event => [
                {
                    text: `${event.title} (${event.user_tickets.length} билетов)`,
                    callback_data: `full_refund_event_${event.id}`
                }
            ]);

            eventButtons.push([{ text: '◀️ Назад', callback_data: 'back_to_command_menu' }]);

            await bot.sendMessage(
                chatId,
                '🎪 *Выберите мероприятие для полного возврата средств*:\n\n' +
                'ℹ️ Будут возвращены средства за все оплаченные билеты этого мероприятия',
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

    async confirmFullRefund(chatId, eventId, messageId) {
        try {
            const event = await Ticket.findByPk(eventId, {
                include: [{
                    model: UserTicket,
                    as: 'user_tickets',
                    where: { 
                        payment_status: 'paid'
                    }
                }]
            });

            if (!event) {
                return await bot.sendMessage(chatId, '❌ Мероприятие не найдено');
            }

            const ticketPrice = parseFloat(event.price).toFixed(2);
            const totalAmount = (parseFloat(event.price) * event.user_tickets.length).toFixed(2);
            
            const eventDate = new Date(event.event_date);
            const isPastEvent = eventDate < new Date();

            await bot.editMessageText(
                `⚠️ *ПОДТВЕРЖДЕНИЕ ПОЛНОГО ВОЗВРАТА* ⚠️\n\n` +
                `📌 *${event.title}*\n` +
                `📅 Дата мероприятия: ${eventDate.toLocaleString()}\n` +
                `🎫 Количество билетов: ${event.user_tickets.length}\n` +
                `💰 Стоимость билета: ${ticketPrice} ₽\n` +
                `💰 Общая сумма: ${totalAmount} ₽\n` +
                `📌 Статус: ${isPastEvent ? '🔴 Прошедшее' : '🟢 Будущее'}\n\n` +
                `*Это действие нельзя отменить! Все средства будут возвращены покупателям.*`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { 
                                    text: '✅ ПОДТВЕРДИТЬ ВОЗВРАТ', 
                                    callback_data: `confirm_full_refund_${eventId}`
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
            await bot.sendMessage(chatId, '⚠️ Ошибка при подтверждении возврата');
        }
    }

    async processFullRefund(chatId, eventId, messageId) {
        try {
            await bot.editMessageText('🔄 *Выполняется полный возврат средств...*', {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [] }
            });

            const refundResult = await refundService.refundEventTickets(eventId);

            if (!refundResult.success) {
                const errors = refundResult.errors || [];
                return await bot.editMessageText(
                    `❌ *ОШИБКА ВОЗВРАТА*\n\n` +
                    `Успешно возвращено: ${refundResult.refundedTickets || 0} билетов\n` +
                    `Не удалось вернуть: ${errors.length} платежей\n\n` +
                    `Первая ошибка: ${errors[0]?.error || 'Неизвестная ошибка'}`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔄 Повторить попытку', callback_data: `full_refund_event_${eventId}` }],
                                [{ text: '◀️ В меню возвратов', callback_data: 'admin_refund' }]
                            ]
                        }
                    }
                );
            }

            const event = await Ticket.findByPk(eventId);

            await bot.editMessageText(
                `✅ *ПОЛНЫЙ ВОЗВРАТ УСПЕШНО ВЫПОЛНЕН*\n\n` +
                `📌 Мероприятие: ${event.title}\n` +
                `💳 Возвращено платежей: ${refundResult.refundedPayments}\n` +
                `🎫 Возвращено билетов: ${refundResult.refundedTickets}\n` +
                `💰 Общая сумма: ${refundResult.totalAmount} ₽\n\n` +
                `📩 Уведомления отправлены покупателям.`,
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
                '⚠️ *КРИТИЧЕСКАЯ ОШИБКА*\n\n' +
                'При выполнении возврата произошла ошибка. Пожалуйста, попробуйте позже или проверьте логи системы.\n\n' +
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
}

export const adminRefundHandler = new AdminRefundHandler();