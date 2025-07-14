// adminHandlers.js
import { bot } from '../botInstance.js';
import { userStates } from '../../state.js';
import ticketService from '../../services/TicketService.js';
import { showMainMenu } from './mainMenu.js';

// Показ главного меню администратора
export const showAdminTicketsMenu = async (chatId) => {
    await bot.sendMessage(chatId, '🛠️ Управление билетами:', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '➕ Создать билет', callback_data: 'admin_create_ticket' },
                    { text: '📋 Список билетов', callback_data: 'admin_list_tickets' }
                ],
                [
                    { text: '✏️ Редактировать билет', callback_data: 'admin_edit_ticket_select' },
                    { text: '❌ Удалить билет', callback_data: 'admin_delete_ticket_select' }
                ],
                [
                    { text: '🔙 На главную', callback_data: 'back_to_main' }
                ]
            ]
        }
    });
};

// Обработчик создания билета
const handleCreateTicket = async (chatId) => {
    await bot.sendMessage(chatId, 'Введите данные билета в формате:\n\n' +
        '<b>Название|Описание|Дата(ГГГГ-ММ-ДД)|Место|Цена|URL изображения</b>\n\n' +
        'Пример: Концерт группы XYZ|Отличный концерт|2023-12-31|Клуб "Француз"|1500|https://example.com/image.jpg',
        { parse_mode: 'HTML' }
    );

    userStates[chatId] = {
        isAdminAction: true,
        step: 'creating_ticket'
    };
};

// Обработчик списка билетов
const handleListTickets = async (chatId) => {
    try {
        const tickets = await ticketService.getAllTickets();

        if (!tickets || tickets.length === 0) {
            return await bot.sendMessage(chatId, '📭 Список билетов пуст');
        }

        let message = '🎟️ <b>Список билетов:</b>\n\n';
        tickets.forEach(ticket => {
            message += `▫️ <b>${ticket.title}</b>\n` +
                `ID: ${ticket.id}\n` +
                `Дата: ${ticket.event_date}\n` +
                `Цена: ${ticket.price} руб.\n\n`;
        });

        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        await showAdminTicketsMenu(chatId);

    } catch (error) {
        console.error('Ошибка при получении списка билетов:', error);
        await bot.sendMessage(chatId, '⚠️ Произошла ошибка при получении списка билетов');
    }
};

// Обработчик выбора билета для редактирования
const handleSelectTicketForEdit = async (chatId) => {
    await bot.sendMessage(chatId, 'Введите ID билета, который хотите отредактировать:');
    userStates[chatId] = {
        isAdminAction: true,
        step: 'selecting_ticket_for_edit'
    };
};

// Обработчик редактирования билета
const handleEditTicket = async (chatId, ticketId) => {
    try {
        const ticket = await ticketService.getTicketById(ticketId);
        if (!ticket) {
            return await bot.sendMessage(chatId, '❌ Билет с указанным ID не найден');
        }

        await bot.sendMessage(chatId, `Текущие данные билета (ID: ${ticket.id}):\n\n` +
            `Название: ${ticket.title}\n` +
            `Описание: ${ticket.description}\n` +
            `Дата: ${ticket.event_date}\n` +
            `Место: ${ticket.event_location}\n` +
            `Цена: ${ticket.price}\n\n` +
            'Введите новые данные в формате:\n\n' +
            '<b>Название|Описание|Дата(ГГГГ-ММ-ДД)|Место|Цена|URL изображения</b>',
            { parse_mode: 'HTML' }
        );

        userStates[chatId] = {
            isAdminAction: true,
            step: 'editing_ticket',
            ticketId: ticketId
        };

    } catch (error) {
        console.error('Ошибка при получении билета:', error);
        await bot.sendMessage(chatId, '⚠️ Произошла ошибка при получении билета');
    }
};

// Обработчик выбора билета для удаления
const handleSelectTicketForDelete = async (chatId) => {
    await bot.sendMessage(chatId, 'Введите ID билета, который хотите удалить:');
    userStates[chatId] = {
        isAdminAction: true,
        step: 'selecting_ticket_for_delete'
    };
};

// Обработчик удаления билета
const handleDeleteTicket = async (chatId, ticketId) => {
    try {
        const result = await ticketService.deleteTicket(ticketId);
        if (result) {
            await bot.sendMessage(chatId, `✅ Билет с ID ${ticketId} успешно удален`);
            await showAdminTicketsMenu(chatId);
        }
    } catch (error) {
        console.error('Ошибка при удалении билета:', error);
        await bot.sendMessage(chatId, `⚠️ Не удалось удалить билет с ID ${ticketId}`);
    }
};

// Обработчик сообщений администратора
export const handleAdminMessages = async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userState = userStates[chatId];

    if (!userState || !userState.isAdminAction) return;

    try {
        // Создание билета
        if (userState.step === 'creating_ticket') {
            const [title, description, event_date, event_location, price, image_url] = text.split('|').map(item => item.trim());

            if (!title || !description || !event_date || !event_location || !price || !image_url) {
                return await bot.sendMessage(chatId, '❌ Неверный формат данных. Пожалуйста, используйте указанный формат');
            }

            const ticketData = {
                title,
                description,
                event_date,
                event_location,
                price: parseFloat(price),
                image_url
            };

            const newTicket = await ticketService.createTicket(ticketData);
            delete userStates[chatId];

            await bot.sendMessage(chatId, `✅ Билет "${newTicket.title}" успешно создан!\nID: ${newTicket.id}`);
            await showAdminTicketsMenu(chatId);
        }

        // Выбор билета для редактирования
        else if (userState.step === 'selecting_ticket_for_edit') {
            const ticketId = parseInt(text);
            if (isNaN(ticketId)) {
                return await bot.sendMessage(chatId, '❌ Пожалуйста, введите числовой ID билета');
            }

            await handleEditTicket(chatId, ticketId);
        }

        // Редактирование билета
        else if (userState.step === 'editing_ticket') {
            const [title, description, event_date, event_location, price, image_url] = text.split('|').map(item => item.trim());

            if (!title || !description || !event_date || !event_location || !price || !image_url) {
                return await bot.sendMessage(chatId, '❌ Неверный формат данных. Пожалуйста, используйте указанный формат');
            }

            const updateData = {
                title,
                description,
                event_date,
                event_location,
                price: parseFloat(price),
                image_url
            };

            const updatedTicket = await ticketService.updateTicket(userState.ticketId, updateData);
            delete userStates[chatId];

            await bot.sendMessage(chatId, `✅ Билет "${updatedTicket.title}" успешно обновлен!`);
            await showAdminTicketsMenu(chatId);
        }

        // Выбор билета для удаления
        else if (userState.step === 'selecting_ticket_for_delete') {
            const ticketId = parseInt(text);
            if (isNaN(ticketId)) {
                return await bot.sendMessage(chatId, '❌ Пожалуйста, введите числовой ID билета');
            }

            await handleDeleteTicket(chatId, ticketId);
            delete userStates[chatId];
        }

    } catch (error) {
        console.error('Ошибка в обработчике администратора:', error);
        await bot.sendMessage(chatId, '⚠️ Произошла ошибка при обработке запроса');
        delete userStates[chatId];
    }
};

// Настройка обработчиков callback для администратора
export const setupAdminHandlers = () => {
    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        const chatId = msg.chat.id;
        const data = callbackQuery.data;

        try {
            // Обработка административных команд
            switch (data) {
                case 'admin_tickets':
                    await showAdminTicketsMenu(chatId);
                    break;

                case 'admin_create_ticket':
                    await handleCreateTicket(chatId);
                    break;

                case 'admin_list_tickets':
                    await handleListTickets(chatId);
                    break;

                case 'admin_edit_ticket_select':
                    await handleSelectTicketForEdit(chatId);
                    break;

                case 'admin_delete_ticket_select':
                    await handleSelectTicketForDelete(chatId);
                    break;

                case 'back_to_main':
                    delete userStates[chatId];
                    await showMainMenu(chatId, true);
                    break;
            }

            await bot.answerCallbackQuery(callbackQuery.id);

        } catch (error) {
            console.error('Ошибка в административном обработчике:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '⚠️ Произошла ошибка', show_alert: true });
        }
    });
};