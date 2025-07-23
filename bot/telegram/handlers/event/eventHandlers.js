import EventService from '../../../services/eventsService.js';
import { bot } from '../../botInstance.js';
import { userCarts, eventDetailsMessages, eventMessages } from '../../../state.js';

export const updateEventButtons = async (chatId, event, quantity) => {
    try {
        const messageId = eventMessages[chatId]?.[event.id];
        if (!messageId) return;

        const keyboard = quantity > 0 ? [
            [
                { text: '➖', callback_data: `decrease_${event.id}` },
                { text: `${quantity} шт.`, callback_data: `show_count_${event.id}` },
                { text: '➕', callback_data: `increase_${event.id}` }
            ],
            [
                { text: 'ℹ️ Подробнее', callback_data: `event_details_${event.id}` },
                { text: '🛒 В корзину', callback_data: `add_to_cart_${event.id}` }
            ]
        ] : [
            [
                { text: '🛒 Купить билет', callback_data: `add_to_cart_${event.id}` },
                { text: 'ℹ️ Подробнее', callback_data: `event_details_${event.id}` }
            ]
        ];

        await bot.editMessageReplyMarkup(
            { inline_keyboard: keyboard },
            {
                chat_id: chatId,
                message_id: messageId
            }
        );
    } catch (error) {
        console.error('Ошибка при обновлении кнопок:', error);
    }
};

// Функция для отправки нового сообщения с событием
export const sendEventMessage = async (chatId, event, quantity = 0) => {
    const eventDate = new Date(event.event_date);
    const formattedDate = eventDate.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    const formattedTime = eventDate.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const caption = `🎟️ *${event.title}*\n` +
        `📅 ${formattedDate} в ${formattedTime}\n` +
        `📍 ${event.event_location}\n` +
        `💰 ${event.price} руб.`;

    const keyboard = quantity > 0 ? [
        [
            { text: '➖', callback_data: `decrease_${event.id}` },
            { text: `${quantity} шт.`, callback_data: `show_count_${event.id}` },
            { text: '➕', callback_data: `increase_${event.id}` }
        ],
        [
            { text: 'ℹ️ Подробнее', callback_data: `event_details_${event.id}` },
            { text: '🛒 В корзину', callback_data: `add_to_cart_${event.id}` }
        ]
    ] : [
        [
            { text: '🛒 Купить билет', callback_data: `add_to_cart_${event.id}` },
            { text: 'ℹ️ Подробнее', callback_data: `event_details_${event.id}` }
        ]
    ];

    try {
        const message = await bot.sendPhoto(chatId, event.image_url || 'https://via.placeholder.com/500', {
            caption: caption,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });

        if (!eventMessages[chatId]) eventMessages[chatId] = {};
        eventMessages[chatId][event.id] = message.message_id;

        return message;
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        throw error;
    }
};

// Функция для обновления всего сообщения с событием (если нужно)
export const updateEventMessage = async (chatId, event, quantity) => {
    try {
        const messageId = eventMessages[chatId]?.[event.id];
        if (!messageId) return;

        const eventDate = new Date(event.event_date);
        const formattedDate = eventDate.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        const formattedTime = eventDate.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const caption = `🎟️ *${event.title}*\n` +
            `📅 ${formattedDate} в ${formattedTime}\n` +
            `📍 ${event.event_location}\n` +
            `💰 ${event.price} руб.`;

        const keyboard = quantity > 0 ? [
            [
                { text: '➖', callback_data: `decrease_${event.id}` },
                { text: `${quantity} шт.`, callback_data: `show_count_${event.id}` },
                { text: '➕', callback_data: `increase_${event.id}` }
            ],
            [
                { text: 'ℹ️ Подробнее', callback_data: `event_details_${event.id}` },
                { text: '🛒 В корзину', callback_data: `add_to_cart_${event.id}` }
            ]
        ] : [
            [
                { text: '🛒 Купить билет', callback_data: `add_to_cart_${event.id}` },
                { text: 'ℹ️ Подробнее', callback_data: `event_details_${event.id}` }
            ]
        ];

        await bot.editMessageCaption(caption, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        console.error('Ошибка при обновлении сообщения:', error);
    }
};

export const showEventDetails = async (chatId, eventId, originalMessageId) => {
    try {
        const event = await EventService.getTicketById(eventId);
        if (!event) {
            return bot.sendMessage(chatId, 'Мероприятие не найдено');
        }

        const eventDate = new Date(event.event_date);
        const formattedDate = eventDate.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        const formattedTime = eventDate.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        let description = `🎭 *${event.title}*\n\n`;
        description += `📅 *Дата и время:* ${formattedDate} в ${formattedTime}\n`;
        description += `📍 *Место проведения:* ${event.event_location}\n`;
        description += `💰 *Цена:* ${event.price} руб.\n\n`;
        description += `📝 *Описание:*\n${event.description || 'Описание отсутствует'}\n\n`;
        description += `ℹ️ *Дополнительная информация:*\n${event.additional_info || 'Дополнительная информация отсутствует'}`;

        const detailsMessage = await bot.sendMessage(chatId, description, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔙 Назад', callback_data: `back_to_event_${eventId}_${originalMessageId}` }
                    ]
                ]
            }
        });

        if (!eventDetailsMessages[chatId]) eventDetailsMessages[chatId] = {};
        eventDetailsMessages[chatId][eventId] = detailsMessage.message_id;

    } catch (error) {
        console.error('Ошибка при показе подробностей:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка при загрузке информации');
    }
};

export const backToEvent = async (chatId, eventId, originalMessageId) => {
    try {
        if (eventDetailsMessages[chatId]?.[eventId]) {
            try {
                await bot.deleteMessage(chatId, eventDetailsMessages[chatId][eventId]);
                delete eventDetailsMessages[chatId][eventId];
            } catch (e) {
                console.error('Ошибка при удалении сообщения с деталями:', e);
            }
        }

        const event = await EventService.getTicketById(eventId);
        if (!event) return;

        const cart = userCarts[chatId] || [];
        const cartItem = cart.find(item => item.eventId === eventId);
        const quantity = cartItem ? cartItem.quantity : 0;

        try {
            await bot.deleteMessage(chatId, originalMessageId);
        } catch (e) {
            console.error('Ошибка при удалении оригинального сообщения:', e);
        }

        await sendEventMessage(chatId, event, quantity);

    } catch (error) {
        console.error('Ошибка при возврате к мероприятию:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка');
    }
};

export const showEventsList = async (chatId) => {
    try {
        const events = await EventService.getAllTickets();

        if (!events?.length) {
            return bot.sendMessage(chatId, '🎭 В данный момент нет доступных мероприятий. Следите за обновлениями!');
        }

        const cart = userCarts[chatId] || [];
        const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

        if (eventMessages[chatId]) {
            for (const [eventId, msgId] of Object.entries(eventMessages[chatId])) {
                try {
                    await bot.deleteMessage(chatId, msgId);
                } catch (e) {
                    console.error('Ошибка при удалении сообщения:', e.message);
                }
            }
            delete eventMessages[chatId];
        }

        await bot.sendMessage(chatId, '🎟️ Доступные мероприятия:', {
            reply_markup: {
                inline_keyboard: [
                    cartItemsCount > 0 ? [
                        { text: `🛒 Корзина (${cartItemsCount})`, callback_data: 'view_cart' },
                        { text: '✅ Оформить заказ', callback_data: 'checkout' }
                    ] : []
                ]
            }
        });

        for (const event of events) {
            const cartItem = cart.find(item => item.eventId === event.id);
            const quantity = cartItem ? cartItem.quantity : 0;
            await sendEventMessage(chatId, event, quantity);
        }
    } catch (error) {
        console.error('Ошибка при отображении мероприятий:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка при загрузке мероприятий. Пожалуйста, попробуйте позже.');
    }
};