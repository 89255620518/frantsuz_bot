export class AdminEventManager {
    constructor(bot, ticketService, userStates) {
        this.bot = bot;
        this.ticketService = ticketService;
        this.userStates = userStates;
        this.editSteps = {
            TITLE: 'edit_title',
            DESCRIPTION: 'edit_description',
            DATE: 'edit_date',
            LOCATION: 'edit_location',
            PRICE: 'edit_price',
            IMAGE: 'edit_image',
            CONFIRM: 'edit_confirm'
        };
    }

    async showMenu(chatId) {
        await this.bot.sendMessage(chatId, '🛠️ Управление билетами:', {
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
    }

    async listTickets(chatId) {
        try {
            const tickets = await this.ticketService.getAllTickets();

            if (!tickets || tickets.length === 0) {
                return await this.bot.sendMessage(chatId, '📭 Список билетов пуст');
            }

            let message = '🎟️ <b>Список билетов:</b>\n\n';
            tickets.forEach(ticket => {
                message += `▫️ <b>${ticket.title}</b>\n` +
                    `ID: ${ticket.id}\n` +
                    `Дата: ${new Date(ticket.event_date).toLocaleDateString()}\n` +
                    `Цена: ${ticket.price} руб.\n\n`;
            });

            await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            await this.showMenu(chatId);

        } catch (error) {
            console.error('Ошибка при получении списка билетов:', error);
            await this.bot.sendMessage(chatId, '⚠️ Произошла ошибка при получении списка билетов');
        }
    }

    async startEditTicket(chatId) {
        await this.bot.sendMessage(chatId, '✏️ Введите ID билета для редактирования или нажмите /cancel для отмены:');
        this.userStates[chatId] = {
            isAdminAction: true,
            step: 'selecting_ticket_for_edit'
        };
    }

    async processEditTicketSelection(chatId, ticketId) {
        try {
            const ticket = await this.ticketService.getTicketById(ticketId);
            if (!ticket) {
                return await this.bot.sendMessage(chatId, '❌ Билет с указанным ID не найден');
            }

            this.userStates[chatId] = {
                isAdminAction: true,
                step: this.editSteps.TITLE,
                ticketId: ticket.id,
                originalTicket: ticket,
                editedTicket: { ...ticket.dataValues }
            };

            await this.showEditFieldMenu(chatId, 'title');

        } catch (error) {
            console.error('Ошибка при получении билета:', error);
            await this.bot.sendMessage(chatId, '⚠️ Произошла ошибка при получении билета');
        }
    }

    async showEditFieldMenu(chatId, field) {
        const state = this.userStates[chatId];
        const ticket = state.editedTicket;

        let message = `✏️ <b>Редактирование билета ID: ${ticket.id}</b>\n\n`;
        message += `Текущее значение <b>${this.getFieldName(field)}</b>:\n` +
                  `${ticket[field] || 'не указано'}\n\n` +
                  'Введите новое значение или выберите действие:';

        const keyboard = [
            [{ text: '⏭️ Пропустить', callback_data: `edit_skip_${field}` }],
            [{ text: '❌ Отменить редактирование', callback_data: 'edit_cancel' }],
            [{ text: '✅ Завершить', callback_data: 'edit_finish' }]
        ];

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    }

    async processEditStep(chatId, text) {
        const state = this.userStates[chatId];
        if (!state) return;

        try {
            switch (state.step) {
                case this.editSteps.TITLE:
                    if (text.length < 3) {
                        await this.bot.sendMessage(chatId, '❌ Название должно содержать минимум 3 символа');
                        return;
                    }
                    state.editedTicket.title = text;
                    state.step = this.editSteps.DESCRIPTION;
                    await this.showEditFieldMenu(chatId, 'description');
                    break;

                case this.editSteps.DESCRIPTION:
                    state.editedTicket.description = text;
                    state.step = this.editSteps.DATE;
                    await this.showEditFieldMenu(chatId, 'event_date');
                    break;

                case this.editSteps.DATE:
                    if (!this.validateDate(text)) {
                        await this.bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте ГГГГ-ММ-ДД');
                        return;
                    }
                    state.editedTicket.event_date = text;
                    state.step = this.editSteps.LOCATION;
                    await this.showEditFieldMenu(chatId, 'event_location');
                    break;

                case this.editSteps.LOCATION:
                    if (text.length < 5) {
                        await this.bot.sendMessage(chatId, '❌ Место должно содержать минимум 5 символов');
                        return;
                    }
                    state.editedTicket.event_location = text;
                    state.step = this.editSteps.PRICE;
                    await this.showEditFieldMenu(chatId, 'price');
                    break;

                case this.editSteps.PRICE:
                    const price = parseFloat(text);
                    if (isNaN(price) || price <= 0) {
                        await this.bot.sendMessage(chatId, '❌ Введите корректную цену (положительное число)');
                        return;
                    }
                    state.editedTicket.price = price;
                    state.step = this.editSteps.IMAGE;
                    await this.showEditFieldMenu(chatId, 'image_url');
                    break;

                case this.editSteps.IMAGE:
                    state.editedTicket.image_url = text;
                    state.step = this.editSteps.CONFIRM;
                    await this.showEditConfirmation(chatId);
                    break;

                default:
                    await this.bot.sendMessage(chatId, 'Неизвестный шаг редактирования');
                    delete this.userStates[chatId];
            }
        } catch (error) {
            console.error('Ошибка при обработке шага редактирования:', error);
            await this.bot.sendMessage(chatId, '⚠️ Произошла ошибка при обработке данных');
            delete this.userStates[chatId];
        }
    }

    async handleEditCallback(chatId, data) {
        const state = this.userStates[chatId];
        if (!state) return;

        try {
            if (data === 'edit_cancel') {
                delete this.userStates[chatId];
                await this.bot.sendMessage(chatId, '❌ Редактирование отменено');
                await this.showMenu(chatId);
                return;
            }

            if (data.startsWith('edit_skip_')) {
                const field = data.replace('edit_skip_', '');
                const nextField = this.getNextField(field);
                
                if (nextField) {
                    state.step = this.editSteps[nextField.toUpperCase()];
                    await this.showEditFieldMenu(chatId, nextField);
                } else {
                    state.step = this.editSteps.CONFIRM;
                    await this.showEditConfirmation(chatId);
                }
                return;
            }

            if (data === 'edit_finish') {
                await this.showEditConfirmation(chatId);
                return;
            }

            if (data === 'edit_confirm') {
                const { ticketId, editedTicket } = state;
                const updatedTicket = await this.ticketService.updateTicket(ticketId, editedTicket);
                delete this.userStates[chatId];
                
                await this.bot.sendMessage(chatId, `✅ Билет "${updatedTicket.title}" успешно обновлен!`);
                await this.showMenu(chatId);
                return;
            }

            if (data === 'edit_continue') {
                state.step = this.editSteps.TITLE;
                await this.showEditFieldMenu(chatId, 'title');
                return;
            }

        } catch (error) {
            console.error('Ошибка при обработке callback:', error);
            await this.bot.sendMessage(chatId, '⚠️ Произошла ошибка при обработке команды');
            delete this.userStates[chatId];
        }
    }

    // Вспомогательные методы
    getFieldName(field) {
        const names = {
            title: 'Название',
            description: 'Описание',
            event_date: 'Дата события',
            event_location: 'Место проведения',
            price: 'Цена',
            image_url: 'Ссылка на изображение'
        };
        return names[field] || field;
    }

    validateDate(dateString) {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateString)) return false;
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }

    getNextField(currentField) {
        const fieldsOrder = ['title', 'description', 'event_date', 'event_location', 'price', 'image_url'];
        const currentIndex = fieldsOrder.indexOf(currentField);
        return currentIndex < fieldsOrder.length - 1 ? fieldsOrder[currentIndex + 1] : null;
    }

    async showEditConfirmation(chatId) {
        const state = this.userStates[chatId];
        const original = state.originalTicket;
        const edited = state.editedTicket;

        let message = '✅ <b>Подтвердите изменения:</b>\n\n';
        message += `<b>Билет ID:</b> ${original.id}\n\n`;

        const fields = ['title', 'description', 'event_date', 'event_location', 'price', 'image_url'];
        let hasChanges = false;

        fields.forEach(field => {
            if (original[field] !== edited[field]) {
                hasChanges = true;
                message += `🔹 <b>${this.getFieldName(field)}:</b>\n` +
                          `Было: ${original[field] || 'не указано'}\n` +
                          `Стало: ${edited[field] || 'не указано'}\n\n`;
            }
        });

        if (!hasChanges) {
            message += '⚠️ Вы не внесли никаких изменений';
        }

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Подтвердить', callback_data: 'edit_confirm' },
                        { text: '❌ Отменить', callback_data: 'edit_cancel' }
                    ],
                    [
                        { text: '🔄 Продолжить редактирование', callback_data: 'edit_continue' }
                    ]
                ]
            }
        });
    }

    async startDeleteTicket(chatId) {
        await this.bot.sendMessage(chatId, 'Введите ID билета, который хотите удалить:');
        this.userStates[chatId] = {
            isAdminAction: true,
            step: 'selecting_ticket_for_delete'
        };
    }

    async processDeleteTicket(chatId, ticketId) {
        try {
            const result = await this.ticketService.deleteTicket(ticketId);
            if (result) {
                await this.bot.sendMessage(chatId, `✅ Билет с ID ${ticketId} успешно удален`);
                await this.showMenu(chatId);
            }
        } catch (error) {
            console.error('Ошибка при удалении билета:', error);
            await this.bot.sendMessage(chatId, `⚠️ Не удалось удалить билет с ID ${ticketId}`);
        }
    }
}