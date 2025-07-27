import { bot } from '../botInstance.js';
import { userStates } from '../../state.js';
import { User } from '../../models/User.js';
import { refundRules } from '../rules/refundRules.js';
import { payRules } from '../rules/payRules.js';
import { pay } from '../rules/pay.js';
import { setupQRHandlers } from './qrHandler.js';

import menuController from './mainMenu.js';
import {
    showEventsList,
    handleAddToCart,
    handleQuantityChange,
    showCart,
    clearCart,
    showEditableCart,
    handleRemoveFromCart,
    handleTicketMessages,
    startCheckout,
    handlePaymentCheck,
    showEventDetails,
    backToEvent,
} from './event/ticketsHandler.js';
import { showContacts } from './contactsHandler.js';
import {
    handleAdminMessages,
    setupAdminHandlers,
    showAdminTicketsMenu
} from './admin/adminHandlers.js';

export const handlePaymentCancel = async (chatId, isAdmin) => {
    await bot.answerCallbackQuery({ text: 'Платеж отменен' });
    if (isAdmin) {
        await showAdminTicketsMenu(chatId);
    } else {
        await showEventsList(chatId);
    }
};

export const handleBackToMain = async (chatId, isAdmin) => {
    if (isAdmin) {
        await showAdminTicketsMenu(chatId);
    } else {
        await showEventsList(chatId);
    }
};

export const handleError = async (chatId, error) => {
    console.error('Error:', error);
    await bot.sendMessage(
        chatId,
        '❌ Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
    );
};

export const setupEventHandlers = () => {
    menuController.setupBotCommands();
    setupAdminHandlers();
    setupQRHandlers();

    bot.onText(/\/start/, menuController.handleStartCommand);
    bot.onText(/\/tickets/, showEventsList);
    bot.onText(/\/cart/, showCart);
    bot.onText(/\/refund/, async (msg) => {
        const chatId = msg.chat.id;
        await refundRules.sendRefundRules(chatId, bot);
    });
    bot.onText(/\/pay_rules/, async (msg) => {
        const chatId = msg.chat.id;
        await payRules.sendPayRules(chatId, bot);
    });
    bot.onText(/\/pay/, async (msg) => {
        const chatId = msg.chat.id;
        await pay.sendPay(chatId, bot);
    });

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

            switch (true) {
                case data.startsWith('event_details_'):
                    const eventId = parseInt(data.split('_')[2]);
                    await showEventDetails(chatId, eventId, messageId);
                    break;

                case data.startsWith('back_to_command_menu'):
                    const dbUser = await User.findOne({ where: { telegram_id: user.id } });
                    await menuController.showMainMenu(chatId, dbUser?.is_admin || false);
                    await bot.answerCallbackQuery(callbackQuery.id);
                    break;

                case data.startsWith('back_to_event_'):
                    const parts = data.split('_');
                    const backEventId = parseInt(parts[3]);
                    const originalMessageId = parseInt(parts[4]);
                    await backToEvent(chatId, backEventId, originalMessageId);
                    break;

                case data.startsWith('add_to_cart_'):
                    const cartEventId = parseInt(data.split('_')[3]);
                    await handleAddToCart(chatId, cartEventId);
                    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Добавлено в корзину' });
                    break;

                case data.startsWith('increase_'):
                    const incEventId = parseInt(data.split('_')[1]);
                    await handleQuantityChange(chatId, incEventId, 'increase');
                    await bot.answerCallbackQuery(callbackQuery.id);
                    break;

                case data.startsWith('decrease_'):
                    const decEventId = parseInt(data.split('_')[1]);
                    await handleQuantityChange(chatId, decEventId, 'decrease');
                    await bot.answerCallbackQuery(callbackQuery.id);
                    break;

                case data === 'view_cart':
                    await showCart(chatId);
                    await bot.answerCallbackQuery(callbackQuery.id);
                    break;

                case data === 'checkout':
                    await startCheckout(chatId);
                    await bot.answerCallbackQuery(callbackQuery.id);
                    break;

                case data.startsWith('check_payment_'):
                    await handlePaymentCheck(
                        chatId, 
                        data.replace('check_payment_', ''),
                        msg.message_id,
                        callbackQuery.id
                    );
                    break;

                case data === 'contacts':
                    await showContacts(chatId);
                    break;

                case data === 'show_tickets':
                    await showEventsList(chatId);
                    await bot.answerCallbackQuery(callbackQuery.id);
                    break;

                case data === 'clear_cart':
                    await clearCart(chatId);
                    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Корзина очищена' });
                    break;

                case data === 'edit_cart':
                    await showEditableCart(chatId);
                    await bot.answerCallbackQuery(callbackQuery.id);
                    break;

                case data.startsWith('remove_from_cart_'):
                    const removeEventId = parseInt(data.split('_')[3]);
                    await handleRemoveFromCart(chatId, removeEventId);
                    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Удалено из корзины' });
                    break;

                case data === 'cancel_payment':
                    await handlePaymentCancel(chatId, isAdmin);
                    break;

                case data === 'admin_tickets' && isAdmin:
                    await showAdminTicketsMenu(chatId);
                    break;

                case data === 'back_to_main':
                    await handleBackToMain(chatId, isAdmin);
                    break;

                case data === 'refund':
                    await refundRules.sendRefundRules(chatId, bot);
                    break;

                case data === 'pay_rules':
                    await payRules.sendPayRules(chatId, bot);
                    break;

                case data === 'pay':
                    await pay.sendPay(chatId, bot);
                    break;

                case data === 'consult_refund':
                    await bot.sendMessage(
                        chatId,
                        '📞 Для консультации по возвратам свяжитесь с нашим менеджером:\n\n' +
                        '• Телефон: +7(968)090-55-50\n' +
                        '• Email: refund@french-club.ru\n\n' +
                        'Мы работаем ежедневно с 12:00 до 23:00',
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🔙 К правилам возврата', callback_data: 'refund' }],
                                    [{ text: '🛎️ В главное меню', callback_data: 'back_to_main' }]
                                ]
                            }
                        }
                    );
                    break;

                default:
                    await bot.answerCallbackQuery(callbackQuery.id);
                    return;
            }
        } catch (error) {
            console.error('Error in callback:', error);
            await handleError(chatId, error);
        }
    });

    bot.on('message', async (msg) => {
        if (!msg?.chat?.id) return;

        const chatId = msg.chat.id;
        const userState = userStates[chatId];

        try {
            const dbUser = await User.findOne({ where: { telegram_id: msg.from.id } });

            if (userState?.isAdminAction) {
                await handleAdminMessages(msg);
                return;
            }

            await handleTicketMessages(msg);
        } catch (error) {
            console.error('Error in message handler:', error);
            await handleError(chatId, error);
        }
    });
};