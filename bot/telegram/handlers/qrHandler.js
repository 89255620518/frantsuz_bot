import { bot } from '../botInstance.js';
import { UserTicket } from '../../models/UserTicket.js';
import { Ticket } from '../../models/Event.js';
import { Order } from '../../models/Orders.js';
import { OrderItem } from '../../models/OrderItem.js';
import { formatDate } from '../../services/dateFormatters.js';

export const setupQRHandlers = () => {
    // Обработчик для сканированных QR-кодов
    bot.onText(/Француз-|Frantsuz-/i, async (msg) => {
        const chatId = msg.chat.id;
        const ticketNumber = msg.text.trim();

        try {
            // Находим билет пользователя
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
                        include: [{
                            model: Order,
                            as: 'order',
                            attributes: ['first_name', 'last_name', 'email', 'phone', 'status']
                        }]
                    }
                ]
            });

            if (!userTicket) {
                return bot.sendMessage(chatId, '❌ Билет не найден. Пожалуйста, проверьте правильность QR-кода.');
            }

            // Проверяем, является ли пользователь администратором
            const user = await User.findOne({ where: { telegram_id: chatId } });
            const isAdmin = user?.is_admin || false;

            // Формируем сообщение с информацией о билете
            let message = `🎟️ *Информация о билете* 🎟️\n\n` +
                `📌 *Мероприятие:* ${userTicket.ticket.title}\n` +
                `📅 *Дата:* ${formatDate(userTicket.ticket.event_date)}\n` +
                `📍 *Место:* ${userTicket.ticket.event_location}\n` +
                `💰 *Стоимость:* ${userTicket.ticket.price} руб.\n\n` +
                `👤 *Данные покупателя:*\n` +
                `• Имя: ${userTicket.order_item.order.first_name} ${userTicket.order_item.order.last_name}\n` +
                `• Email: ${userTicket.order_item.order.email}\n` +
                `• Телефон: ${userTicket.order_item.order.phone}\n\n` +
                `🔄 *Статус оплаты:* ${userTicket.payment_status === 'paid' ? '✅ Оплачен' : '❌ Не оплачен'}\n` +
                `🎭 *Статус билета:* ${userTicket.is_used ? '❌ Использован' : '✅ Активен'}`;

            // Если есть изображение мероприятия, отправляем его с подписью
            if (userTicket.ticket.image_url) {
                const options = {
                    caption: message,
                    parse_mode: 'Markdown'
                };

                // Добавляем кнопку для администратора
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

                await bot.sendPhoto(chatId, userTicket.ticket.image_url, options);
            } else {
                // Если нет изображения, просто отправляем текст
                const options = {
                    parse_mode: 'Markdown'
                };

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

                await bot.sendMessage(chatId, message, options);
            }
        } catch (error) {
            console.error('Ошибка при обработке QR-кода:', error);
            await bot.sendMessage(chatId, '❌ Произошла ошибка при обработке QR-кода. Пожалуйста, попробуйте позже.');
        }
    });

    // Обработчик для отметки билета как использованного
    bot.on('callback_query', async (callbackQuery) => {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;

        if (data.startsWith('mark_used_')) {
            try {
                const ticketId = data.split('_')[2];
                const userTicket = await UserTicket.findByPk(ticketId);

                if (!userTicket) {
                    return bot.answerCallbackQuery(callbackQuery.id, { text: 'Билет не найден' });
                }

                // Проверяем, является ли пользователь администратором
                const user = await User.findOne({ where: { telegram_id: chatId } });
                if (!user?.is_admin) {
                    return bot.answerCallbackQuery(callbackQuery.id, { text: 'Недостаточно прав' });
                }

                // Обновляем статус билета
                await userTicket.update({
                    is_used: true,
                    used_at: new Date()
                });

                // Удаляем кнопку из сообщения
                await bot.editMessageReplyMarkup(
                    { inline_keyboard: [] },
                    {
                        chat_id: chatId,
                        message_id: callbackQuery.message.message_id
                    }
                );

                await bot.answerCallbackQuery(callbackQuery.id, { text: 'Билет отмечен как использованный' });
                await bot.sendMessage(chatId, '✅ Билет успешно отмечен как использованный.');
            } catch (error) {
                console.error('Ошибка при отметке билета:', error);
                await bot.answerCallbackQuery(callbackQuery.id, { text: 'Произошла ошибка' });
            }
        }
    });
};