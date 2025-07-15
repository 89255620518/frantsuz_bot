// eventHandlers.js
import { bot } from '../botInstance.js';
import { userStates } from '../../state.js';
import {
    handleStartCommand,
    showMainMenu
} from './mainMenu.js';
import {
    showEventsList,
    startTicketPurchase,
    completeTicketPurchase,
    handleTicketsCommand
} from './ticketsHandler.js';
import { showContacts } from './contactsHandler.js';
import { checkPaymentStatus } from '../../services/paykeeper.js';
import { User } from '../../models/User.js';
import { handleAdminMessages, setupAdminHandlers, showAdminTicketsMenu } from './admin/adminHandlers.js';

export const setupEventHandlers = () => {
    setupAdminHandlers();

    bot.onText(/\/start/, handleStartCommand);
    bot.onText(/\/tickets/, handleTicketsCommand);

    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        if (!msg?.chat?.id) return;

        const chatId = msg.chat.id;
        const data = callbackQuery.data;
        const user = callbackQuery.from;

        try {
            if (!data) {
                await bot.answerCallbackQuery(callbackQuery.id);
                return;
            }

            const dbUser = await User.findOne({ where: { telegram_id: user.id } });
            const isAdmin = dbUser?.is_admin || false;

            if (data === 'contacts') {
                await showContacts(chatId);
            }
            else if (data === 'show_tickets') {
                await showEventsList(chatId);
            }
            else if (data.startsWith('buy_ticket_')) {
                const eventId = parseInt(data.split('_')[2]);
                if (!isNaN(eventId)) {
                    await startTicketPurchase(chatId, eventId, user?.id);
                }
            }
            else if (data.startsWith('check_payment_')) {
                const invoiceId = data.split('_')[2];
                if (invoiceId) {
                    await checkPaymentStatus(bot, chatId, invoiceId);
                }
            }
            else if (data === 'cancel_payment') {
                delete userStates[chatId];
                await bot.sendMessage(
                    chatId,
                    '💔 *Очень жаль, что вы не оформили билет!*\n\nВозможно, вы передумаете? Мы будем рады видеть вас!',
                    { parse_mode: 'Markdown' }
                );
                setTimeout(() => showMainMenu(chatId, isAdmin), 3000);
            }
            else if (data === 'admin_tickets' && isAdmin) {
                await showAdminTicketsMenu(chatId);
            }
            else if (data === 'back_to_main') {
                delete userStates[chatId];
                await showMainMenu(chatId, isAdmin);
            }

            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('Error in callback:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
        }
    });

    bot.on('message', async (msg) => {
        if (!msg?.chat?.id) return;

        const chatId = msg.chat.id;
        const userState = userStates[chatId];

        const dbUser = await User.findOne({ where: { telegram_id: msg.from.id } });

        // Добавляем вызов обработчика административных сообщений
        if (userState?.isAdminAction) {
            await handleAdminMessages(msg);
            return;
        }

        if (!msg.text || msg.text.startsWith('/') || !userState) return;

        try {
            if (userState.step === 'name') {
                const nameParts = msg.text.trim().split(/\s+/);
                if (nameParts.length < 2) {
                    return bot.sendMessage(chatId, '❌ Пожалуйста, введите имя и фамилию через пробел');
                }

                userState.name = msg.text;
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
                await completeTicketPurchase(chatId, userState);
            }
        } catch (error) {
            console.error('Error in message handler:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
        }
    });
};