import EventService from '../../../services/eventsService.js';
import TicketService from '../../../services/ticketService.js';
import { User } from '../../../models/User.js';
import { bot } from '../../botInstance.js';
import { userCarts, cartMessages, cartDetailsMessages } from '../../../state.js';
import { updateEventButtons, showEventsList } from './eventHandlers.js'


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