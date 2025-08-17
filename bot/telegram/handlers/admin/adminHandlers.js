import { bot } from '../../botInstance.js';
import { userStates } from '../../../state.js';
import { AdminEventManager } from './AdminEventManager.js';
import { EventWizard } from './eventWizzard.js';
import EventService from '../../../services/eventsService.js';
import { adminPanelController } from './adminPanel.js';
import menuController from '../mainMenu.js';
// import { adminRefundHandler } from './AdminRefundPanel.js';
import { AdminNotificationsHandler } from './adminNotifications.js';

const eventManager = new AdminEventManager(bot, EventService, userStates);
const eventWizard = new EventWizard(bot, EventService, userStates);
const adminNotificationsHandler = new AdminNotificationsHandler(); // Инициализация обработчика уведомлений

export const handleAdminMessages = async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userState = userStates[chatId];

    if (!userState || !userState.isAdminAction) return;

    if (userState.wizard === 'event') {
        await eventWizard.handleMessage(msg);
        return;
    }

    try {
        if (userState.step === 'selecting_ticket_for_edit') {
            const ticketId = parseInt(text);
            if (isNaN(ticketId)) {
                return await bot.sendMessage(
                    chatId,
                    '❌ Неверный ID мероприятия\nПожалуйста, введите числовой ID',
                    { parse_mode: 'HTML' }
                );
            }
            await eventManager.processEditTicketSelection(chatId, ticketId);
            return;
        }

        if (userState.step === 'selecting_ticket_for_delete') {
            const ticketId = parseInt(text);
            if (isNaN(ticketId)) {
                return await bot.sendMessage(
                    chatId,
                    '❌ Неверный ID мероприятия\nПожалуйста, введите числовой ID',
                    { parse_mode: 'HTML' }
                );
            }
            await eventManager.processDeleteTicket(chatId, ticketId);
            delete userStates[chatId];
            return;
        }

        if (userState.step && userState.step.startsWith('edit_')) {
            await eventManager.processEditStep(chatId, text);
            return;
        }

    } catch (error) {
        console.error('Admin message handler error:', error);
        await bot.sendMessage(chatId, '⚠️ Произошла ошибка');
        delete userStates[chatId];
    }
};

export const setupAdminHandlers = () => {
    // Обработчики callback_query из AdminNotificatonsHandler
    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        const chatId = msg.chat.id;
        const data = callbackQuery.data;
        const userState = userStates[chatId];

        try {
            // Сначала проверяем обработчики уведомлений
            if (data === 'admin_refund') {
                await adminNotificationsHandler.showRefundTypeSelection(chatId);
                await bot.answerCallbackQuery(callbackQuery.id);
                return;
            } else if (data.startsWith('refund_type_') || 
                     data.startsWith('full_refund_event_') || 
                     data.startsWith('confirm_full_refund_') || 
                     data === 'cancel_full_refund') {
                // Пропускаем обработку в AdminNotificatonsHandler
                return;
            }

            // Остальная логика обработки
            if (!userState?.isAdminAction && !data.startsWith('admin_')) {
                return;
            }

            if (userState?.isAdminAction && data.startsWith('edit_')) {
                await eventManager.handleEditCallback(chatId, data);
                await bot.answerCallbackQuery(callbackQuery.id);
                return;
            }

            switch (data) {
                case 'admin_tickets':
                    await eventManager.showMenu(chatId);
                    break;

                case 'admin_create_ticket':
                    await eventWizard.startCreation(chatId);
                    break;

                case 'admin_list_tickets':
                    await eventManager.listTickets(chatId);
                    break;

                case 'admin_edit_ticket_select':
                    await eventManager.startEditTicket(chatId);
                    break;

                case 'admin_delete_ticket_select':
                    await eventManager.startDeleteTicket(chatId);
                    break;

                case 'back_to_main':
                    delete userStates[chatId];
                    await menuController.showMainMenu(chatId, true);
                    break;
                case 'admin_panel':
                    await adminPanelController.handleAdminPanel(chatId);
                    break;
                case 'admin_full_stats':
                    await adminPanelController.getFullStatistics(chatId);
                    break;

                default:
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        show_alert: false
                    });
                    return;
            }

            await bot.answerCallbackQuery(callbackQuery.id);

        } catch (error) {
            console.error('Admin callback handler error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, {
                show_alert: true
            });
        }
    });

    // Добавляем обработчики из AdminNotificatonsHandler
    bot.on('callback_query', async (callbackQuery) => {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        
        try {
            if (data.startsWith('refund_type_')) {
                const refundType = data.split('_')[2];
                await adminNotificationsHandler.showAllEventsForRefund(chatId, refundType);
            } else if (data.startsWith('full_refund_event_')) {
                const parts = data.split('_');
                const eventId = parts[3];
                const refundType = parts[4];
                await adminNotificationsHandler.confirmFullRefund(chatId, eventId, refundType, callbackQuery.message.message_id);
            } else if (data.startsWith('confirm_full_refund_')) {
                const parts = data.split('_');
                const eventId = parts[3];
                const refundType = parts[4];
                await adminNotificationsHandler.processFullRefund(chatId, eventId, refundType, callbackQuery.message.message_id);
            } else if (data === 'cancel_full_refund') {
                await bot.deleteMessage(chatId, callbackQuery.message.message_id);
            }
        } catch (error) {
            console.error('Notification handler error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '⚠️ Ошибка обработки уведомления',
                show_alert: true
            });
        }
    });
};

export const showAdminTicketsMenu = (chatId) => {
    eventManager.showMenu(chatId);
};