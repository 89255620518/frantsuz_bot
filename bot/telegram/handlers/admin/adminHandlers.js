import { bot } from '../../botInstance.js';
import { userStates } from '../../../state.js';
import { showMainMenu } from '../mainMenu.js';
import { AdminEventManager } from './AdminEventManager.js';
import { EventWizard } from './eventWizzard.js';
import ticketService from '../../../services/ticketService.js';

const eventManager = new AdminEventManager(bot, ticketService, userStates);
const eventWizard = new EventWizard(bot, ticketService, userStates);

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
        // Выбор билета для редактирования
        if (userState.step === 'selecting_ticket_for_edit') {
            const ticketId = parseInt(text);
            if (isNaN(ticketId)) {
                return await bot.sendMessage(chatId, '❌ Пожалуйста, введите числовой ID билета');
            }
            await eventManager.processEditTicketSelection(chatId, ticketId);
            return;
        }

        // Выбор билета для удаления
        if (userState.step === 'selecting_ticket_for_delete') {
            const ticketId = parseInt(text);
            if (isNaN(ticketId)) {
                return await bot.sendMessage(chatId, '❌ Пожалуйста, введите числовой ID билета');
            }
            await eventManager.processDeleteTicket(chatId, ticketId);
            delete userStates[chatId];
            return;
        }

        // Обработка шагов редактирования
        if (userState.step && userState.step.startsWith('edit_')) {
            await eventManager.processEditStep(chatId, text);
            return;
        }

    } catch (error) {
        console.error('Ошибка в обработчике администратора:', error);
        await bot.sendMessage(chatId, '⚠️ Произошла ошибка при обработке запроса');
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
            // Обработка кнопок редактирования
            if (userState?.isAdminAction && data.startsWith('edit_')) {
                await eventManager.handleEditCallback(chatId, data);
                await bot.answerCallbackQuery(callbackQuery.id);
                return;
            }

            // Основные команды
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
                    await showMainMenu(chatId, true);
                    break;

                default:
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: 'Неизвестная команда',
                        show_alert: true
                    });
                    return;
            }

            await bot.answerCallbackQuery(callbackQuery.id);

        } catch (error) {
            console.error('Ошибка в обработчике:', error);
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '⚠️ Ошибка при обработке команды',
                show_alert: true
            });
        }
    });
};

export const showAdminTicketsMenu = (chatId) => {
    eventManager.showMenu(chatId);
};