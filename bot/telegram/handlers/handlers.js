// eventHandlers.js (полная версия с интеграцией "Подробнее")
import { bot } from '../botInstance.js';
import { userStates, userCarts, eventDetailsMessages } from '../../state.js';
import {
    handleStartCommand,
    showMainMenu
} from './mainMenu.js';
import {
    showEventsList,
    handleAddToCart,
    handleQuantityChange,
    showCart,
    handleTicketMessages,
    startCheckout,
    showEventDetails,
    backToEvent
} from './event/ticketsHandler.js';
import { showContacts } from './contactsHandler.js';
import { checkPaymentStatus } from '../../services/paykeeper.js';
import { User } from '../../models/User.js';
import {
    handleAdminMessages,
    setupAdminHandlers,
    showAdminTicketsMenu
} from './admin/adminHandlers.js';

export const setupEventHandlers = () => {
    setupAdminHandlers();

    bot.onText(/\/start/, handleStartCommand);
    bot.onText(/\/tickets/, showEventsList);
    bot.onText(/\/cart/, showCart);

    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        if (!msg?.chat?.id) return;

        const chatId = msg.chat.id;
        const data = callbackQuery.data;
        const user = callbackQuery.from;
        const messageId = msg.message_id;

        try {
            if (!data) {
                await bot.answerCallbackQuery(callbackQuery.id);
                return;
            }

            const dbUser = await User.findOne({ where: { telegram_id: user.id } });
            const isAdmin = dbUser?.is_admin || false;

            // Обработка билетов
            if (data.startsWith('event_details_')) {
                const eventId = parseInt(data.split('_')[2]);
                await showEventDetails(chatId, eventId, messageId);
            }
            else if (data.startsWith('back_to_event_')) {
                const parts = data.split('_');
                const eventId = parseInt(parts[3]);
                const originalMessageId = parseInt(parts[4]);
                await backToEvent(chatId, eventId, originalMessageId);
            }
            else if (data.startsWith('add_to_cart_')) {
                const eventId = parseInt(data.split('_')[3]);
                await handleAddToCart(chatId, eventId);
            }
            else if (data.startsWith('increase_')) {
                const eventId = parseInt(data.split('_')[1]);
                await handleQuantityChange(chatId, eventId, 'increase');
            }
            else if (data.startsWith('decrease_')) {
                const eventId = parseInt(data.split('_')[1]);
                await handleQuantityChange(chatId, eventId, 'decrease');
            }
            else if (data === 'view_cart') {
                await showCart(chatId);
            }
            else if (data === 'checkout') {
                await startCheckout(chatId);
            }
            // Остальные обработчики
            else if (data === 'contacts') {
                await showContacts(chatId);
            }
            else if (data === 'show_tickets') {
                await showEventsList(chatId);
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
                if (eventDetailsMessages[chatId]) {
                    // Удаляем все сообщения с деталями мероприятий
                    for (const [eventId, detailsMsgId] of Object.entries(eventDetailsMessages[chatId])) {
                        try {
                            await bot.deleteMessage(chatId, detailsMsgId);
                        } catch (e) {
                            console.error('Ошибка при удалении сообщения с деталями:', e);
                        }
                    }
                    delete eventDetailsMessages[chatId];
                }
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

        // Обработка административных сообщений
        if (userState?.isAdminAction) {
            await handleAdminMessages(msg);
            return;
        }

        // Обработка сообщений, связанных с билетами
        await handleTicketMessages(msg);
    });
};