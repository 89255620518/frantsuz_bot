import { bot } from '../../botInstance.js';
import { userStates } from '../../../state.js';
import { AdminEventManager } from './AdminEventManager.js';
import { EventWizard } from './eventWizzard.js';
import EventService from '../../../services/eventsService.js';
import { adminPanelController } from './adminPanel.js';
import menuController from '../mainMenu.js';
import { adminRefundHandler } from './AdminRefundPanel.js';

const eventManager = new AdminEventManager(bot, EventService, userStates);
const eventWizard = new EventWizard(bot, EventService, userStates);

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

    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        const chatId = msg.chat.id;
        const data = callbackQuery.data;
        const userState = userStates[chatId];

        try {
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
                case 'admin_refund':
                    await adminRefundHandler.showRefundMenu(chatId);
                    break;

                default:
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        // text: '❌ Неизвестная команда',
                        show_alert: false
                    });
                    return;
            }

            await bot.answerCallbackQuery(callbackQuery.id);

        } catch (error) {
            console.error('Admin callback handler error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, {
                // text: '⚠️ Ошибка обработки',
                show_alert: true
            });
        }
    });
};

export const showAdminTicketsMenu = (chatId) => {
    eventManager.showMenu(chatId);
};