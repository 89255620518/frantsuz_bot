import TicketService from '../../../services/ticketService.js';
import OrderService from '../../../services/orderService.js';
import { User } from '../../../models/User.js';
import { bot } from '../../botInstance.js';
import PaymentService from '../../../services/paykeeper.js';
import { userStates, userCarts, cartMessages, cartDetailsMessages } from '../../../state.js';

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
        
        // Обновляем данные пользователя
        await user.update({ 
            first_name, 
            last_name, 
            phone, 
            email 
        });

        // Рассчитываем общую сумму
        const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Создаем платеж в PayKeeper
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

        // Обновляем билеты с payment_id
        for (const item of cartItems) {
            for (const ticketId of item.ticketIds) {
                await TicketService.updatePaymentId(ticketId, paymentResult.paymentId);
            }
        }

        // Создаем заказ в базе данных
        const order = await OrderService.createOrder(
            { 
                telegram_id: chatId, 
                first_name, 
                last_name, 
                phone, 
                email 
            },
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
                payment_id: paymentResult.paymentId,
                payment_method: 'paykeeper'
            }
        );

        // Настраиваем автоматическую проверку статуса платежа
        PaymentService.setupPaymentAutoCheck(
            paymentResult.paymentId,
            async (message) => {
                await bot.sendMessage(chatId, message);
                
                // Если платеж успешен, обновляем интерфейс
                if (message.includes('✅ Платеж успешно завершен')) {
                    try {
                        // Можно обновить сообщение с кнопками оплаты
                        await bot.editMessageReplyMarkup(
                            { inline_keyboard: [] },
                            { chat_id: chatId, message_id: cartMessages[chatId] }
                        );
                    } catch (e) {
                        console.error('Ошибка при обновлении сообщения:', e);
                    }
                }
            }
        );

        // Очищаем корзину и состояние
        delete userCarts[chatId];
        delete userStates[chatId];

        // Удаляем сообщения корзины
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

        const message = await bot.sendMessage(
            chatId,
            `✅ *Заказ успешно оформлен!*\n\n` +
            `📦 Номер заказа: ${order.id}\n` +
            `💰 Сумма: ${totalAmount} руб.\n` +
            `📧 Билеты будут отправлены на: ${email}\n\n` +
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

        // Сохраняем ID сообщения для возможного обновления
        cartMessages[chatId] = message.message_id;

    } catch (error) {
        console.error('Ошибка оформления заказа:', error);

        // Отменяем билеты в случае ошибки
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
            'Пожалуйста, попробуйте позже или обратитесь в поддержку.',
            { parse_mode: 'Markdown' }
        );
    }
};

export const handlePaymentCheck = async (chatId, paymentId, messageId, callbackQueryId) => {
    try {
        // Отвечаем на callback запрос
        await bot.answerCallbackQuery(callbackQueryId, {
            text: 'Проверяем статус платежа...',
            show_alert: false
        });

        // Проверяем статус платежа
        const isPaid = await PaymentService.checkPaymentAndNotify(
            paymentId,
            async (message) => {
                await bot.sendMessage(chatId, message);
                
                // Если платеж успешен, обновляем сообщение с кнопками
                if (message.includes('✅ Платеж успешно завершен')) {
                    try {
                        await bot.editMessageReplyMarkup(
                            { inline_keyboard: [] },
                            { chat_id: chatId, message_id: messageId }
                        );
                        await bot.editMessageText(
                            `✅ *Заказ успешно оплачен!*\n\n` +
                            `📧 Билеты отправлены на указанный email.\n` +
                            `Если вы не получили билеты, проверьте папку "Спам".`,
                            { 
                                chat_id: chatId, 
                                message_id: messageId,
                                parse_mode: 'Markdown'
                            }
                        );
                    } catch (e) {
                        console.error('Ошибка при обновлении сообщения:', e);
                    }
                }
            }
        );

        if (!isPaid) {
            await bot.sendMessage(
                chatId,
                '⏳ Платеж еще не поступил. Попробуйте проверить позже.'
            );
        }

    } catch (error) {
        console.error('Ошибка при проверке платежа:', error);
        await bot.sendMessage(
            chatId,
            '⚠ Произошла ошибка при проверке платежа. Пожалуйста, попробуйте позже.'
        );
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

// Функция для обработки вебхуков от PayKeeper
export const handlePaykeeperWebhook = async (req, res) => {
    try {
        const { id: paymentId, status } = req.body;
        
        if (!paymentId || !status) {
            return res.status(400).send('Invalid webhook data');
        }

        // Обрабатываем успешный платеж
        if (status === 'paid') {
            const result = await PaymentService.processSuccessfulPayment(paymentId);
            
            if (result.success && result.userTicket) {
                // Отправляем уведомление пользователю
                const message = `✅ Ваш платеж успешно завершен!\n` +
                               `🎫 Номер билета: ${result.userTicket.ticket_number}\n` +
                               `📅 Дата оплаты: ${new Date().toLocaleString()}`;
                
                await bot.sendMessage(result.userTicket.telegram_chat_id, message);
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Internal server error');
    }
};