import EventService from '../../../services/eventsService.js';

export const showEventsList = async (chatId) => {
    const events = await EventService.getAllEvents();

    if (!events?.length) {
        return bot.sendMessage(chatId, '🎭 В данный момент нет доступных мероприятий. Следите за обновлениями!');
    }

    const cart = userCarts[chatId];
    const cartButton = cart?.length ? [{ text: `🛒 Корзина (${cart.reduce((sum, item) => sum + item.quantity, 0)})`, callback_data: 'view_cart' }] : [];

    await bot.sendMessage(chatId, '🎟️ Доступные мероприятия:', {
        reply_markup: {
            inline_keyboard: [cartButton]
        }
    });

    for (const event of events) {
        const caption = `🎟️ *${event.title}*\n📅 ${event.event_date.toLocaleDateString()} в ${event.event_date.toLocaleTimeString()}\n📍 ${event.event_location}\n💰 ${event.price} руб.\n\n${event.description || ''}`;

        await bot.sendPhoto(chatId, event.image_url || 'https://via.placeholder.com/500', {
            caption,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Добавить в корзину', callback_data: `add_to_cart_${event.id}` }]
                ]
            }
        });
    }
};

export const handleAddToCart = async (chatId, eventId) => {
    try {
        const event = await EventService.getEventById(eventId);
        if (!event) {
            return bot.sendMessage(chatId, '❌ Мероприятие не найдено.');
        }

        // Проверяем доступность билетов
        const canAdd = await EventService.checkTicketsAvailability(eventId, 1);
        if (!canAdd) {
            return bot.sendMessage(chatId, '❌ К сожалению, билеты на это мероприятие закончились.');
        }

        if (!userCarts[chatId]) {
            userCarts[chatId] = [];
        }

        const existingItem = userCarts[chatId].find(item => item.eventId == eventId);
        if (existingItem) {
            // Проверяем доступность при увеличении количества
            const canIncrease = await EventService.checkTicketsAvailability(eventId, existingItem.quantity + 1);
            if (!canIncrease) {
                return bot.sendMessage(chatId, '❌ Достигнуто максимальное количество билетов на это мероприятие.');
            }
            existingItem.quantity += 1;
        } else {
            userCarts[chatId].push({
                eventId,
                title: event.title,
                price: event.price,
                quantity: 1,
                image: event.image_url,
                event_date: event.event_date,
                event_location: event.event_location
            });
        }

        await bot.sendMessage(chatId, `✅ "${event.title}" добавлен в корзину!`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🛒 Перейти в корзину', callback_data: 'view_cart' }],
                    [{ text: '🎟️ Продолжить покупки', callback_data: 'show_tickets' }]
                ]
            }
        });
    } catch (error) {
        console.error('Ошибка при добавлении в корзину:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
};

export const completeTicketPurchase = async (chatId, userState) => {
    try {
        const user = await User.findOne({ where: { telegram_id: userState.dbUserId } });
        if (!user) {
            throw new Error('Пользователь не найден');
        }

        await user.update({
            phone: userState.phone,
            email: userState.email
        });

        // Подготавливаем данные для создания билетов
        const ticketsToCreate = [];
        let totalAmount = 0;

        for (const item of userState.cartItems) {
            // Проверяем доступность перед оплатой
            const available = await EventService.checkTicketsAvailability(item.eventId, item.quantity);
            if (!available) {
                throw new Error(`Билеты на "${item.title}" больше недоступны`);
            }

            for (let i = 0; i < item.quantity; i++) {
                ticketsToCreate.push({
                    title: item.title,
                    description: `Билет на мероприятие ${item.title}`,
                    image_url: item.image,
                    event_date: item.event_date,
                    event_location: item.event_location,
                    price: item.price,
                    ticket_number: EventService.generateTicketNumber(),
                    is_used: false,
                    user_id: user.id,
                    event_id: item.eventId
                });
            }
            totalAmount += item.price * item.quantity;
        }

        await bot.sendMessage(
            chatId,
            '🔄 *Оформляем ваш заказ...*\n\nПожалуйста, подождите несколько секунд.',
            { parse_mode: 'Markdown' }
        );

        // Создаем платеж
        const paymentResult = await processPayment(bot, chatId, {
            customer: {
                name: userState.name,
                phone: userState.phone,
                email: userState.email
            },
            tickets: ticketsToCreate,
            totalAmount
        });

        if (!paymentResult.success) {
            throw new Error('Ошибка создания платежа');
        }

        // Создаем билеты в базе данных
        await EventService.createTickets(ticketsToCreate);

        // Отправляем подтверждение
        await bot.sendMessage(
            chatId,
            `🎉 *Ваш заказ оформлен!*\n\n` +
            `Номер заказа: ${paymentResult.invoiceId}\n` +
            `Сумма: ${totalAmount} руб.\n\n` +
            `Билеты будут отправлены на email: ${userState.email}`,
            { parse_mode: 'Markdown' }
        );

        // Очищаем корзину
        delete userCarts[chatId];

    } catch (error) {
        console.error('Ошибка оформления заказа:', error);
        await bot.sendMessage(
            chatId,
            `❌ *Ошибка оформления заказа*\n\n${error.message}\n\n` +
            `Пожалуйста, попробуйте позже или обратитесь в поддержку.`,
            { parse_mode: 'Markdown' }
        );
    } finally {
        delete userStates[chatId];
    }
};