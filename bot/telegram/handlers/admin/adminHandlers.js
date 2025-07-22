import { bot } from '../../botInstance.js';
import { userStates } from '../../../state.js';
import menuController from '../mainMenu.js';
import { AdminEventManager } from './AdminEventManager.js';
import { EventWizard } from './eventWizzard.js';
import EventService from '../../../services/eventsService.js';

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
                    '❌ <b>Неверный ID мероприятия</b>\n' +
                    'Пожалуйста, введите числовой ID',
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
                    '❌ <b>Неверный ID мероприятия</b>\n' +
                    'Пожалуйста, введите числовой ID',
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
        console.error('Ошибка в обработчике администратора:', error);
        await bot.sendMessage(
            chatId,
            '⚠️ <b>Произошла ошибка</b>\n' +
            'Попробуйте позже или обратитесь к разработчику',
            { parse_mode: 'HTML' }
        );
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
                // Пропускаем обработку, не отвечаем на callback
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

                default:
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: '❌ Неизвестная команда',
                        show_alert: false
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