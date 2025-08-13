export class AdminEventManager {
    constructor(bot, EventService, userStates) {
        this.bot = bot;
        this.eventService = EventService;
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
        await this.bot.sendMessage(chatId, '🎛️ <b>Панель управления мероприятиями</b>', {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✨ Создать мероприятие', callback_data: 'admin_create_ticket' },
                        { text: '📜 Список мероприятий', callback_data: 'admin_list_tickets' }
                    ],
                    [
                        { text: '✏️ Редактировать', callback_data: 'admin_edit_ticket_select' },
                        { text: '🗑️ Удалить', callback_data: 'admin_delete_ticket_select' }
                    ],
                    [
                        { text: '🏠 На главную', callback_data: 'back_to_command_menu' }
                    ]
                ]
            }
        });
    }

    async listTickets(chatId) {
        try {
            const tickets = await this.eventService.getAllTickets();

            if (!tickets || tickets.length === 0) {
                return await this.bot.sendMessage(
                    chatId,
                    '📭 <b>Список мероприятий пуст</b>\n\n' +
                    'Здесь будут отображаться все созданные мероприятия.',
                    { parse_mode: 'HTML' }
                );
            }

            await this.bot.sendMessage(
                chatId,
                '📋 <b>Список мероприятий:</b>\n' +
                `Всего мероприятий: <b>${tickets.length}</b>`,
                { parse_mode: 'HTML' }
            );

            for (const ticket of tickets) {
                try {
                    const eventDate = new Date(ticket.event_date);
                    const formattedDate = eventDate.toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        weekday: 'long'
                    });
                    const formattedTime = eventDate.toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    const message =
                        `🎭 <b>${ticket.title}</b>\n\n` +
                        `📅 <b>Дата:</b> ${formattedDate} в ${formattedTime}\n` +
                        `📍 <b>Место:</b> ${ticket.event_location}\n` +
                        `💰 <b>Цена:</b> ${ticket.price} руб.\n\n` +
                        `🆔 ID: <code>${ticket.id}</code>\n` +
                        `📝 <b>Описание:</b>\n${ticket.description || 'нет описания'}\n\n` +
                        `🔢 Номер билета: <code>${ticket.ticket_number}</code>`;

                    if (ticket.image_url && ticket.image_url.startsWith('http')) {
                        await this.bot.sendPhoto(chatId, ticket.image_url, {
                            caption: message,
                            parse_mode: 'HTML'
                        });
                    } else {
                        await this.bot.sendMessage(chatId, message, {
                            parse_mode: 'HTML',
                            disable_web_page_preview: true
                        });
                    }
                } catch (error) {
                    console.error(`Ошибка при отправке билета ID ${ticket.id}:`, error);
                    await this.bot.sendMessage(
                        chatId,
                        `⚠️ <b>Ошибка отображения билета ID: ${ticket.id}</b>\n` +
                        `Название: ${ticket.title}\n` +
                        `Попробуйте просмотреть его через редактирование`,
                        { parse_mode: 'HTML' }
                    );
                }
            }

            await this.showMenu(chatId);

        } catch (error) {
            console.error('Ошибка при получении списка билетов:', error);
            await this.bot.sendMessage(
                chatId,
                '⚠️ <b>Ошибка при загрузке мероприятий</b>\n' +
                'Попробуйте позже или обратитесь к разработчику',
                { parse_mode: 'HTML' }
            );
        }
    }

    async sendTicketDetails(chatId, ticket) {
        try {
            const eventDate = new Date(ticket.event_date);
            const formattedDate = eventDate.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                weekday: 'long'
            });
            const formattedTime = eventDate.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const message =
                `🎟️ <b>${ticket.title}</b>\n\n` +
                `📅 <b>Дата и время:</b>\n${formattedDate} в ${formattedTime}\n\n` +
                `📍 <b>Место проведения:</b>\n${ticket.event_location}\n\n` +
                `💰 <b>Цена билета:</b> ${ticket.price} руб.\n\n` +
                `📝 <b>Описание:</b>\n${ticket.description || 'нет описания'}\n\n` +
                `🆔 ID: <code>${ticket.id}</code>\n` +
                `🔢 Номер билета: <code>${ticket.ticket_number}</code>`;

            if (ticket.image_url && ticket.image_url.startsWith('http')) {
                await this.bot.sendPhoto(chatId, ticket.image_url, {
                    caption: message,
                    parse_mode: 'HTML'
                });
            } else {
                await this.bot.sendMessage(chatId, message, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                });
            }
        } catch (error) {
            console.error('Ошибка при отправке деталей билета:', error);
            throw error;
        }
    }

    async startEditTicket(chatId) {
        await this.bot.sendMessage(
            chatId,
            '✏️ <b>Редактирование мероприятия</b>\n\n' +
            'Введите ID мероприятия, которое хотите изменить:\n' +
            'Или нажмите /cancel для отмены',
            { parse_mode: 'HTML' }
        );
        this.userStates[chatId] = {
            isAdminAction: true,
            step: 'selecting_ticket_for_edit'
        };
    }

    async processEditTicketSelection(chatId, ticketId) {
        try {
            const ticket = await this.eventService.getTicketById(ticketId);
            if (!ticket) {
                return await this.bot.sendMessage(
                    chatId,
                    '❌ <b>Мероприятие не найдено</b>\n\n' +
                    'Проверьте правильность введенного ID',
                    { parse_mode: 'HTML' }
                );
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
            await this.bot.sendMessage(
                chatId,
                '⚠️ <b>Ошибка при загрузке мероприятия</b>\n' +
                'Попробуйте позже или обратитесь к разработчику',
                { parse_mode: 'HTML' }
            );
        }
    }

    async showEditFieldMenu(chatId, field) {
        const state = this.userStates[chatId];
        const ticket = state.editedTicket;

        let message = `✏️ <b>Редактирование мероприятия</b>\n\n`;
        message += `🆔 ID: <code>${ticket.id}</code>\n\n`;
        message += `📌 <b>${this.getFieldName(field)}:</b>\n`;
        message += `<i>${ticket[field] || 'не указано'}</i>\n\n`;
        message += 'Введите новое значение или выберите действие:';

        const keyboard = [
            [{ text: '⏭️ Пропустить', callback_data: `edit_skip_${field}` }],
            [
                { text: '❌ Отменить', callback_data: 'edit_cancel' },
                { text: '✅ Завершить', callback_data: 'edit_finish' }
            ]
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
                        await this.bot.sendMessage(
                            chatId,
                            '❌ <b>Название слишком короткое</b>\n' +
                            'Минимальная длина - 3 символа',
                            { parse_mode: 'HTML' }
                        );
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
                        await this.bot.sendMessage(
                            chatId,
                            '❌ <b>Неверный формат даты</b>\n' +
                            'Используйте формат: <code>ГГГГ-ММ-ДД</code>',
                            { parse_mode: 'HTML' }
                        );
                        return;
                    }
                    state.editedTicket.event_date = text;
                    state.step = this.editSteps.LOCATION;
                    await this.showEditFieldMenu(chatId, 'event_location');
                    break;

                case this.editSteps.LOCATION:
                    if (text.length < 5) {
                        await this.bot.sendMessage(
                            chatId,
                            '❌ <b>Название места слишком короткое</b>\n' +
                            'Минимальная длина - 5 символов',
                            { parse_mode: 'HTML' }
                        );
                        return;
                    }
                    state.editedTicket.event_location = text;
                    state.step = this.editSteps.PRICE;
                    await this.showEditFieldMenu(chatId, 'price');
                    break;

                case this.editSteps.PRICE:
                    const price = parseFloat(text);
                    if (isNaN(price) || price <= 0) {
                        await this.bot.sendMessage(
                            chatId,
                            '❌ <b>Неверная цена</b>\n' +
                            'Введите положительное число',
                            { parse_mode: 'HTML' }
                        );
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
            await this.bot.sendMessage(
                chatId,
                '⚠️ <b>Ошибка при обработке данных</b>\n' +
                'Попробуйте еще раз',
                { parse_mode: 'HTML' }
            );
            delete this.userStates[chatId];
        }
    }

    async handleEditCallback(chatId, data) {
        const state = this.userStates[chatId];
        if (!state) return;

        try {
            if (data === 'edit_cancel') {
                delete this.userStates[chatId];
                await this.bot.sendMessage(
                    chatId,
                    '❌ <b>Редактирование отменено</b>',
                    { parse_mode: 'HTML' }
                );
                await this.showMenu(chatId);
                return;
            }
            if (data.startsWith('edit_skip_')) {
                ч
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
                const updatedTicket = await this.eventService.updateTicket(ticketId, editedTicket);
                delete this.userStates[chatId];

                await this.bot.sendMessage(
                    chatId,
                    `✅ <b>Мероприятие обновлено!</b>\n\n` +
                    `🎭 <b>${updatedTicket.title}</b>\n` +
                    `🆔 ID: <code>${updatedTicket.id}</code>`,
                    { parse_mode: 'HTML' }
                );
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
            await this.bot.sendMessage(
                chatId,
                '⚠️ <b>Ошибка при обработке команды</b>',
                { parse_mode: 'HTML' }
            );
            delete this.userStates[chatId];
        }
    }

    getFieldName(field) {
        const names = {
            title: 'Название мероприятия',
            description: 'Описание',
            event_date: 'Дата и время',
            event_location: 'Место проведения',
            price: 'Цена билета',
            image_url: 'Изображение'
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
        message += `🆔 <b>ID мероприятия:</b> <code>${original.id}</code>\n\n`;

        const fields = ['title', 'description', 'event_date', 'event_location', 'price', 'image_url'];
        let hasChanges = false;

        fields.forEach(field => {
            if (original[field] !== edited[field]) {
                hasChanges = true;
                message += `🔹 <b>${this.getFieldName(field)}:</b>\n` +
                    `▫️ <i>Было:</i> ${original[field] || 'не указано'}\n` +
                    `▫️ <i>Стало:</i> ${edited[field] || 'не указано'}\n\n`;
            }
        });

        if (!hasChanges) {
            message += '⚠️ <b>Вы не внесли никаких изменений</b>';
        }

        const keyboard = [
            [
                { text: '✅ Подтвердить', callback_data: 'edit_confirm' },
                { text: '❌ Отменить', callback_data: 'edit_cancel' }
            ]
        ];

        if (hasChanges) {
            keyboard.push([
                { text: '✏️ Продолжить редактирование', callback_data: 'edit_continue' }
            ]);
        }

        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    }

    async startDeleteTicket(chatId) {
        await this.bot.sendMessage(
            chatId,
            '🗑️ <b>Удаление мероприятия</b>\n\n' +
            'Введите ID мероприятия, которое хотите удалить:',
            { parse_mode: 'HTML' }
        );
        this.userStates[chatId] = {
            isAdminAction: true,
            step: 'selecting_ticket_for_delete'
        };
    }

    async processDeleteTicket(chatId, ticketId) {
        try {
            const result = await this.eventService.deleteTicket(ticketId);
            if (result) {
                await this.bot.sendMessage(
                    chatId,
                    `✅ <b>Мероприятие удалено</b>\n\n` +
                    `ID: <code>${ticketId}</code>`,
                    { parse_mode: 'HTML' }
                );
                await this.showMenu(chatId);
            }
        } catch (error) {
            console.error('Ошибка при удалении билета:', error);
            await this.bot.sendMessage(
                chatId,
                `⚠️ <b>Не удалось удалить мероприятие</b>\n\n` +
                `ID: <code>${ticketId}</code>`,
                { parse_mode: 'HTML' }
            );
        }
    }
}