import { bot } from '../botInstance.js';
import { userStates } from '../../state.js';
import { User } from '../../models/User.js';
import { refundRules } from '../rules/refundRules.js';
import { payRules } from '../rules/payRules.js';
import { pay } from '../rules/pay.js';
import { setupQRScanner, processTicket } from './qrHandler.js';

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
    setupQRScanner();
    menuController.setupBotCommands();
    setupAdminHandlers();

    bot.onText(/\/start/, menuController.handleStartCommand);
    bot.onText(/\/tickets/, showEventsList);
    bot.onText(/\/cart/, showCart);

    // Команды, связанные с оплатой и правилами
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

    // Веб-приложения и разделы клуба
    bot.onText(/\/menu/, async (msg) => {
        await bot.sendMessage(msg.chat.id, "🍽️ Открываю меню бара и кухни...", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Перейти в меню", web_app: { url: process.env.WEB_APP_URL_MENU } }]
                ]
            }
        });
    });

    bot.onText(/\/billiard/, async (msg) => {
        await bot.sendMessage(msg.chat.id, "🎯 Открываю раздел бильярда...", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Перейти к бильярду", web_app: { url: process.env.WEB_APP_URL_BILLARD } }]
                ]
            }
        });
    });

    bot.onText(/\/karaoke/, async (msg) => {
        await bot.sendMessage(msg.chat.id, "🎤 Открываю раздел караоке...", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Перейти к караоке", web_app: { url: process.env.WEB_APP_URL_CARAOKE } }]
                ]
            }
        });
    });

    bot.onText(/\/disco/, async (msg) => {
        await bot.sendMessage(msg.chat.id, "💿 Открываю диско-бар...", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Перейти в диско-бар", web_app: { url: process.env.WEB_APP_URL_dISCO } }]
                ]
            }
        });
    });

    bot.onText(/\/lounge/, async (msg) => {
        await bot.sendMessage(msg.chat.id, "🛋️ Открываю лаунж зону...", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Перейти в лаунж", web_app: { url: process.env.WEB_APP_URL_LAUNZH } }]
                ]
            }
        });
    });

    bot.onText(/\/playstation/, async (msg) => {
        await bot.sendMessage(msg.chat.id, "🎮 Открываю раздел игровых приставок...", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Перейти к Playstation", web_app: { url: process.env.WEB_APP_URL_PLAYSTATIONS } }]
                ]
            }
        });
    });

    bot.onText(/\/games/, async (msg) => {
        await bot.sendMessage(msg.chat.id, "🎲 Открываю раздел настольных игр...", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Перейти к играм", web_app: { url: process.env.WEB_APP_URL_TABLEPLAY } }]
                ]
            }
        });
    });

    bot.onText(/\/events/, async (msg) => {
        await bot.sendMessage(msg.chat.id, "📅 Открываю афишу мероприятий...", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Перейти к афише", web_app: { url: process.env.WEB_APP_URL_AFISHA } }]
                ]
            }
        });
    });

    bot.onText(/\/reserve/, async (msg) => {
        await bot.sendMessage(msg.chat.id, "🛎️ Открываю раздел бронирования...", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Перейти к бронированию", web_app: { url: process.env.WEB_APP_URL_RESERVE } }]
                ]
            }
        });
    });

    bot.onText(/\/show_tickets/, async (msg) => {
        const chatId = msg.chat.id;
        await showEventsList(chatId);
    });

    bot.onText(/\/contacts/, async (msg) => {
        const chatId = msg.chat.id;
        await showContacts(chatId);
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

            // Обработка QR-кода (имеет абсолютный приоритет)
            if (msg.text) {
                // Обрабатываем прямые номера билетов
                const qrPattern = /^(Француз-|Frantsuz-)\d+/i;

                // Обрабатываем команду /start с параметром (URL)
                const startQrPattern = /^\/start\s+(?:Француз-|Frantsuz-)?(\d+)/i;

                let ticketNumber = null;

                // Проверяем обычный формат билета
                if (qrPattern.test(msg.text.trim())) {
                    ticketNumber = msg.text.trim();
                }
                // Проверяем команду /start с параметром
                else if (msg.text.startsWith('/start ')) {
                    const match = msg.text.match(startQrPattern);
                    if (match && match[1]) {
                        ticketNumber = `Француз-${match[1]}`;
                    }
                }

                if (ticketNumber) {
                    await processTicket(chatId, ticketNumber);
                    return; // Важно: завершаем обработку здесь
                }
            }

            // Остальная логика обработки сообщений...
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