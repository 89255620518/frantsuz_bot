import EventService from '../../../services/eventsService.js';
import TicketService from '../../../services/ticketService.js';
import OrderService from '../../../services/orderService.js';
import { User } from '../../../models/User.js';
import { bot } from '../../botInstance.js';
import PaymentService from '../../../services/paykeeper.js';
import { userStates, userCarts, eventDetailsMessages, eventMessages, cartMessages, cartDetailsMessages } from '../../../state.js';

// Функция для обновления кнопок в сообщении с событием
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

// Остальные функции остаются без изменений, но используют updateEventButtons вместо updateEventMessage
// при работе с корзиной (handleQuantityChange, handleRemoveFromCart и т.д.)

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

export const showMiniCart = async (chatId) => {
    const cart = userCarts[chatId];
    if (!cart || cart.length === 0) {
        if (cartMessages[chatId]) {
            try {
                await bot.deleteMessage(chatId, cartMessages[chatId]);
                delete cartMessages[chatId];
            } catch (e) {
                console.error('Ошибка при удалении сообщения корзины:', e);
            }
        }
        return;
    }

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    let message = `🛒 *Текущая корзина*\n`;
    message += `🎟️ Билетов: ${totalItems}\n`;
    message += `💰 Сумма: ${totalAmount} руб.\n\n`;
    message += `📝 Для оформления заказа нажмите "Оформить заказ"`;

    try {
        if (cartMessages[chatId]) {
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: cartMessages[chatId],
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🛒 Показать корзину', callback_data: 'view_cart' },
                            { text: '✅ Оформить заказ', callback_data: 'checkout' }
                        ],
                        [
                            { text: '🔙 К мероприятиям', callback_data: 'show_tickets' }
                        ]
                    ]
                }
            });
        } else {
            const sentMessage = await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🛒 Показать корзину', callback_data: 'view_cart' },
                            { text: '✅ Оформить заказ', callback_data: 'checkout' }
                        ],
                        [
                            { text: '🔙 К мероприятиям', callback_data: 'show_tickets' }
                        ]
                    ]
                }
            });
            cartMessages[chatId] = sentMessage.message_id;
        }
    } catch (error) {
        console.error('Ошибка при обновлении корзины:', error);
    }
};

export const showCart = async (chatId) => {
    try {
        const cart = userCarts[chatId];
        if (!cart || cart.length === 0) {
            if (cartDetailsMessages[chatId]) {
                try {
                    await bot.deleteMessage(chatId, cartDetailsMessages[chatId]);
                    delete cartDetailsMessages[chatId];
                } catch (e) {
                    console.error('Ошибка при удалении сообщения деталей корзины:', e);
                }
            }
            return bot.sendMessage(chatId, '🛒 Ваша корзина пуста.');
        }

        let message = '🛒 *Ваша корзина*\n\n';
        let totalAmount = 0;

        cart.forEach((item, index) => {
            totalAmount += item.price * item.quantity;
            message += `🎭 *${item.title}*\n` +
                `📅 ${new Date(item.event_date).toLocaleDateString('ru-RU')}\n` +
                `📍 ${item.event_location}\n` +
                `💰 ${item.price} руб. x ${item.quantity} = ${item.price * item.quantity} руб.\n\n`;
        });

        message += `💵 *Итого: ${totalAmount} руб.*`;

        try {
            if (cartDetailsMessages[chatId]) {
                await bot.editMessageText(message, {
                    chat_id: chatId,
                    message_id: cartDetailsMessages[chatId],
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '✅ Оформить заказ', callback_data: 'checkout' },
                                { text: '✏️ Изменить', callback_data: 'edit_cart' }
                            ],
                            [
                                { text: '❌ Очистить корзину', callback_data: 'clear_cart' },
                                { text: '🔙 К мероприятиям', callback_data: 'show_tickets' }
                            ]
                        ]
                    }
                });
            } else {
                const sentMessage = await bot.sendMessage(chatId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '✅ Оформить заказ', callback_data: 'checkout' },
                                { text: '✏️ Изменить', callback_data: 'edit_cart' }
                            ],
                            [
                                { text: '❌ Очистить корзину', callback_data: 'clear_cart' },
                                { text: '🔙 К мероприятиям', callback_data: 'show_tickets' }
                            ]
                        ]
                    }
                });
                cartDetailsMessages[chatId] = sentMessage.message_id;
            }
        } catch (error) {
            console.error('Ошибка при обновлении деталей корзины:', error);
        }

    } catch (error) {
        console.error('Ошибка при отображении корзины:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка при загрузке корзины.');
    }
};

export const clearCart = async (chatId) => {
    try {
        const cart = userCarts[chatId];
        if (!cart || cart.length === 0) {
            return bot.sendMessage(chatId, '🛒 Ваша корзина уже пуста.');
        }

        for (const item of cart) {
            for (const ticketId of item.ticketIds) {
                await TicketService.cancelPendingTicket(ticketId);
            }
        }

        delete userCarts[chatId];
        
        if (cartMessages[chatId]) {
            try {
                await bot.deleteMessage(chatId, cartMessages[chatId]);
                delete cartMessages[chatId];
            } catch (e) {
                console.error('Ошибка при удалении сообщения корзины:', e);
            }
        }
        
        if (cartDetailsMessages[chatId]) {
            try {
                await bot.deleteMessage(chatId, cartDetailsMessages[chatId]);
                delete cartDetailsMessages[chatId];
            } catch (e) {
                console.error('Ошибка при удалении сообщения деталей корзины:', e);
            }
        }

        await bot.sendMessage(chatId, '🛒 Корзина успешно очищена.');
        await showEventsList(chatId);

    } catch (error) {
        console.error('Ошибка при очистке корзины:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка при очистке корзины.');
    }
};

export const showEditableCart = async (chatId) => {
    try {
        const cart = userCarts[chatId];
        if (!cart || cart.length === 0) {
            return bot.sendMessage(chatId, '🛒 Ваша корзина пуста.');
        }

        let message = '🛒 *Редактирование корзины*\n\n';
        let totalAmount = 0;

        cart.forEach((item) => {
            totalAmount += item.price * item.quantity;
            message += `🎭 *${item.title}*\n` +
                `📅 ${new Date(item.event_date).toLocaleDateString('ru-RU')}\n` +
                `📍 ${item.event_location}\n` +
                `💰 ${item.price} руб. x ${item.quantity} = ${item.price * item.quantity} руб.\n\n`;
        });

        message += `💵 *Итого: ${totalAmount} руб.*`;

        const itemButtons = cart.map(item => [
            { 
                text: `➖ ${item.title}`, 
                callback_data: `decrease_${item.eventId}` 
            },
            { 
                text: `➕ ${item.title}`, 
                callback_data: `increase_${item.eventId}` 
            },
            { 
                text: `❌ Удалить ${item.title}`, 
                callback_data: `remove_from_cart_${item.eventId}` 
            }
        ]);

        const keyboard = [
            ...itemButtons,
            [
                { text: '✅ Завершить редактирование', callback_data: 'view_cart' },
                { text: '❌ Очистить корзину', callback_data: 'clear_cart' }
            ],
            [
                { text: '🔙 К мероприятиям', callback_data: 'show_tickets' }
            ]
        ];

        try {
            if (cartDetailsMessages[chatId]) {
                await bot.editMessageText(message, {
                    chat_id: chatId,
                    message_id: cartDetailsMessages[chatId],
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
            } else {
                const sentMessage = await bot.sendMessage(chatId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
                cartDetailsMessages[chatId] = sentMessage.message_id;
            }
        } catch (error) {
            console.error('Ошибка при обновлении редактируемой корзины:', error);
        }

    } catch (error) {
        console.error('Ошибка при отображении редактируемой корзины:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка при загрузке корзины.');
    }
};

export const handleRemoveFromCart = async (chatId, eventId) => {
    try {
        const event = await EventService.getTicketById(eventId);
        if (!event) {
            return bot.sendMessage(chatId, '❌ Мероприятие не найдено.');
        }

        const cart = userCarts[chatId] || [];
        const cartItemIndex = cart.findIndex(item => item.eventId === eventId);
        
        if (cartItemIndex === -1) return;

        const cartItem = cart[cartItemIndex];

        for (const ticketId of cartItem.ticketIds) {
            await TicketService.cancelPendingTicket(ticketId).catch(console.error);
        }

        cart.splice(cartItemIndex, 1);
        
        if (cart.length === 0) {
            delete userCarts[chatId];
        }

        await updateEventButtons(chatId, event, 0);
        
        if (cart.length > 0) {
            await showEditableCart(chatId);
            await showMiniCart(chatId);
        } else {
            if (cartMessages[chatId]) {
                try {
                    await bot.deleteMessage(chatId, cartMessages[chatId]);
                    delete cartMessages[chatId];
                } catch (e) {
                    console.error('Ошибка при удалении сообщения корзины:', e);
                }
            }
            if (cartDetailsMessages[chatId]) {
                try {
                    await bot.deleteMessage(chatId, cartDetailsMessages[chatId]);
                    delete cartDetailsMessages[chatId];
                } catch (e) {
                    console.error('Ошибка при удалении сообщения деталей корзины:', e);
                }
            }
            await bot.sendMessage(chatId, '🛒 Товар удален из корзины. Корзина теперь пуста.');
        }

    } catch (error) {
        console.error('Ошибка при удалении из корзины:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
};

export const handleAddToCart = async (chatId, eventId) => {
    try {
        const event = await EventService.getTicketById(eventId);
        if (!event) {
            return bot.sendMessage(chatId, '❌ Мероприятие не найдено.');
        }

        const user = await User.findOne({ where: { telegram_id: chatId } });
        if (!user) {
            return bot.sendMessage(chatId, '❌ Пользователь не найден. Пожалуйста, зарегистрируйтесь сначала.');
        }

        const userTicket = await TicketService.createPendingTicket(chatId, eventId);

        if (!userCarts[chatId]) {
            userCarts[chatId] = [];
        }

        let cartItem = userCarts[chatId].find(item => item.eventId === event.id);

        if (cartItem) {
            cartItem.quantity += 1;
            cartItem.ticketIds.push(userTicket.id);
        } else {
            cartItem = {
                eventId: event.id,
                title: event.title,
                price: event.price,
                quantity: 1,
                image: event.image_url,
                event_date: event.event_date,
                event_location: event.event_location,
                ticketIds: [userTicket.id]
            };
            userCarts[chatId].push(cartItem);
        }

        await updateEventButtons(chatId, event, cartItem.quantity);
        await showMiniCart(chatId);

    } catch (error) {
        console.error('Ошибка при добавлении в корзину:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
};

export const handleQuantityChange = async (chatId, eventId, action) => {
    try {
        const event = await EventService.getTicketById(eventId);
        if (!event) {
            return bot.sendMessage(chatId, '❌ Мероприятие не найдено.');
        }

        const cart = userCarts[chatId] || [];
        const cartItemIndex = cart.findIndex(item => item.eventId === eventId);
        
        if (cartItemIndex === -1) return;

        const cartItem = cart[cartItemIndex];
        let newQuantity = cartItem.quantity;
        let shouldRemoveFromCart = false;

        if (action === 'increase') {
            const user = await User.findOne({ where: { telegram_id: chatId } });
            if (!user) {
                return bot.sendMessage(chatId, '❌ Пользователь не найден.');
            }

            const userTicket = await TicketService.createPendingTicket(chatId, eventId);
            cartItem.quantity += 1;
            cartItem.ticketIds.push(userTicket.id);
            newQuantity = cartItem.quantity;
        } else if (action === 'decrease') {
            if (cartItem.quantity > 1) {
                cartItem.quantity -= 1;
                const ticketId = cartItem.ticketIds.pop();
                await TicketService.cancelPendingTicket(ticketId);
                newQuantity = cartItem.quantity;
            } else {
                for (const ticketId of cartItem.ticketIds) {
                    await TicketService.cancelPendingTicket(ticketId).catch(console.error);
                }
                cart.splice(cartItemIndex, 1);
                shouldRemoveFromCart = true;
                newQuantity = 0;
                
                if (cart.length === 0) {
                    delete userCarts[chatId];
                }
            }
        }

        await updateEventButtons(chatId, event, newQuantity);
        await showMiniCart(chatId);
        
        if (cartDetailsMessages[chatId]) {
            if (cart.length > 0) {
                await showEditableCart(chatId);
            } else {
                try {
                    await bot.deleteMessage(chatId, cartDetailsMessages[chatId]);
                    delete cartDetailsMessages[chatId];
                } catch (e) {
                    console.error('Ошибка при удалении сообщения деталей корзины:', e);
                }
            }
        }

    } catch (error) {
        console.error('Ошибка при изменении количества:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
};

export const startCheckout = async (chatId) => {
    try {
        const cart = userCarts[chatId];
        if (!cart || cart.length === 0) {
            return bot.sendMessage(chatId, '🛒 Ваша корзина пуста.');
        }

        const user = await User.findOne({ where: { telegram_id: chatId } });
        if (!user) {
            return bot.sendMessage(chatId, '❌ Пользователь не найден. Пожалуйста, зарегистрируйтесь сначала.');
        }

        userStates[chatId] = {
            step: 'first_name',
            cartItems: cart,
            dbUserId: user.id
        };

        await bot.sendMessage(chatId, '✏️ Введите ваше имя:', {
            reply_markup: { force_reply: true }
        });

    } catch (error) {
        console.error('Ошибка при начале оформления заказа:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
};

export const completeCheckout = async (chatId, userData) => {
    try {
        const { first_name, last_name, phone, email, cartItems } = userData;

        if (!first_name || !last_name || !phone || !email || !cartItems?.length) {
            throw new Error('Недостаточно данных для оформления');
        }

        const user = await User.findOne({ where: { telegram_id: chatId } });
        if (!user) throw new Error('Пользователь не найден');
        await user.update({ first_name, last_name, phone, email });

        const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const paymentResult = await PaymentService.createInvoice({
            id: cartItems[0].ticketIds[0],
            userId: chatId,
            eventId: cartItems[0].eventId,
            price: totalAmount,
            customer: { first_name, last_name, phone, email },
            event: {
                title: cartItems[0].title,
                date: cartItems[0].event_date,
                location: cartItems[0].event_location
            }
        });

        if (!paymentResult.success) {
            throw new Error(paymentResult.error || 'Ошибка при создании платежа');
        }

        for (const item of cartItems) {
            for (const ticketId of item.ticketIds) {
                await TicketService.updatePaymentId(ticketId, paymentResult.paymentId);
            }
        }

        const order = await OrderService.createOrder(
            { telegram_id: chatId, first_name, last_name, phone, email },
            cartItems.map(item => ({
                id: item.ticketIds[0],
                price: item.price,
                quantity: item.quantity,
                event: {
                    title: item.title,
                    event_date: item.event_date,
                    event_location: item.event_location
                }
            })),
            {
                id: paymentResult.paymentId,
                method: 'paykeeper'
            }
        );

        delete userCarts[chatId];
        delete userStates[chatId];

        if (cartMessages[chatId]) {
            try {
                await bot.deleteMessage(chatId, cartMessages[chatId]);
                delete cartMessages[chatId];
            } catch (e) {
                console.error('Ошибка при удалении сообщения корзины:', e);
            }
        }
        
        if (cartDetailsMessages[chatId]) {
            try {
                await bot.deleteMessage(chatId, cartDetailsMessages[chatId]);
                delete cartDetailsMessages[chatId];
            } catch (e) {
                console.error('Ошибка при удалении сообщения деталей корзины:', e);
            }
        }

        await bot.sendMessage(
            chatId,
            `✅ *Заказ успешно оформлен!*\n\n` +
            `📦 Номер заказа: ${order.id}\n` +
            `💰 Сумма: ${totalAmount} руб.\n` +
            `📧 Билеты отправлены на: ${email}\n\n` +
            `Для оплаты нажмите кнопку ниже:`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 Оплатить', url: paymentResult.paymentUrl }],
                        [{ text: '🔄 Проверить оплату', callback_data: `check_payment_${paymentResult.paymentId}` }]
                    ]
                }
            }
        );

    } catch (error) {
        console.error('Ошибка оформления заказа:', error);

        if (userData?.cartItems) {
            for (const item of userData.cartItems) {
                for (const ticketId of item.ticketIds) {
                    await TicketService.cancelPendingTicket(ticketId).catch(console.error);
                }
            }
        }

        await bot.sendMessage(
            chatId,
            '❌ *Ошибка при оформлении заказа*\n\n' +
            'Пожалуйста, попробуйте позже или обратитесь в поддержку:\n' +
            '📞 +7(968)090-55-50',
            { parse_mode: 'Markdown' }
        );
    }
};

export const handlePaymentCheck = async (chatId, paymentId, messageId, callbackQueryId) => {
    try {
        // Сначала отвечаем на callback, чтобы Telegram знал, что запрос получен
        await bot.answerCallbackQuery(callbackQueryId, { 
            text: 'Проверяем статус платежа...',
            show_alert: false
        });

        // Затем выполняем проверку платежа (это может занять время)
        const isPaid = await PaymentService.checkPaymentStatus(paymentId);

        if (isPaid) {
            const userState = userStates[chatId];
            if (userState) {
                const result = await PaymentService.handleSuccessfulPayment(
                    paymentId,
                    {
                        first_name: userState.first_name,
                        last_name: userState.last_name,
                        phone: userState.phone,
                        email: userState.email
                    }
                );

                if (result.success) {
                    // Отправляем новое сообщение вместо редактирования старого
                    await bot.sendMessage(
                        chatId,
                        '✅ Оплата подтверждена! Билеты отправлены на ваш email.'
                    );
                    
                    // Удаляем старое сообщение с кнопками оплаты
                    try {
                        await bot.deleteMessage(chatId, messageId);
                    } catch (e) {
                        console.error('Ошибка при удалении сообщения:', e);
                    }
                } else {
                    await bot.sendMessage(
                        chatId,
                        'Оплата подтверждена, но возникла ошибка при отправке билетов.'
                    );
                }
            }
        } else {
            // Если оплата еще не прошла, отправляем новое сообщение
            await bot.sendMessage(
                chatId,
                'Оплата еще не получена. Попробуйте позже.'
            );
        }
    } catch (error) {
        console.error('Ошибка при проверке платежа:', error);
        await bot.sendMessage(
            chatId,
            'Произошла ошибка при проверке платежа. Пожалуйста, попробуйте позже.'
        );
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

export const handleTicketMessages = async (msg) => {
    const chatId = msg.chat.id;
    const userState = userStates[chatId];

    if (!msg.text || msg.text.startsWith('/') || !userState) return;

    try {
        if (userState.step === 'first_name') {
            if (msg.text.trim().length < 2) {
                return bot.sendMessage(chatId, '❌ Имя должно содержать минимум 2 символа');
            }

            userState.first_name = msg.text.trim();
            userState.step = 'last_name';
            await bot.sendMessage(chatId, '✏️ Теперь введите вашу фамилию:', {
                reply_markup: { force_reply: true }
            });
        }
        else if (userState.step === 'last_name') {
            if (msg.text.trim().length < 2) {
                return bot.sendMessage(chatId, '❌ Фамилия должна содержать минимум 2 символа');
            }

            userState.last_name = msg.text.trim();
            userState.step = 'phone';
            await bot.sendMessage(chatId, '📞 Введите ваш номер телефона в формате +7XXXXXXXXXX:', {
                reply_markup: { force_reply: true }
            });
        }
        else if (userState.step === 'phone') {
            const phoneRegex = /^(\+7|8)[0-9]{10}$/;
            const cleanPhone = msg.text.replace(/[^\d+]/g, '');

            if (!phoneRegex.test(cleanPhone)) {
                return bot.sendMessage(chatId, '❌ Неверный формат телефона. Введите в формате +7XXXXXXXXXX');
            }

            userState.phone = cleanPhone;
            userState.step = 'email';
            await bot.sendMessage(chatId, '📧 Введите ваш email (на него будет отправлен билет):', {
                reply_markup: { force_reply: true }
            });
        }
        else if (userState.step === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(msg.text)) {
                return bot.sendMessage(chatId, '❌ Неверный формат email. Пожалуйста, введите корректный email');
            }

            userState.email = msg.text;
            await completeCheckout(chatId, userState);
        }
    } catch (error) {
        console.error('Error in message handler:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
};