export class EventWizard {
    constructor(bot, EventService, userStates) {
        this.bot = bot;
        this.eventService = EventService;
        this.userStates = userStates;
    }

    async startCreation(chatId) {
        await this.bot.sendMessage(
            chatId,
            '✨ <b>Создание нового мероприятия</b>\n\n' +
            'Введите данные по шагам. На каждом шаге вы можете:\n' +
            '▫️ Отправить новое значение\n' +
            '▫️ Использовать команду /skip для пропуска\n' +
            '▫️ Использовать команду /cancel для отмены',
            { parse_mode: 'HTML' }
        );

        this.userStates[chatId] = {
            isAdminAction: true,
            wizard: 'event',
            step: 'title',
            data: {}
        };

        await this.askForTitle(chatId);
    }

    async handleMessage(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;
        const userState = this.userStates[chatId];

        if (!userState || userState.wizard !== 'event') return false;

        try {
            switch (userState.step) {
                case 'title': return this.handleTitle(chatId, text);
                case 'description': return this.handleDescription(chatId, text);
                case 'date': return this.handleDate(chatId, text);
                case 'time': return this.handleTime(chatId, text);
                case 'price': return this.handlePrice(chatId, text);
                case 'image': return this.handleImage(chatId, msg);
                case 'location': return this.handleLocation(chatId, text);
                default: return false;
            }
        } catch (error) {
            console.error('EventWizard error:', error);
            await this.bot.sendMessage(
                chatId,
                '⚠️ <b>Произошла ошибка</b>\n' +
                'Попробуйте еще раз или начните заново',
                { parse_mode: 'HTML' }
            );
            delete this.userStates[chatId];
            return true;
        }
    }

    async askForTitle(chatId) {
        await this.bot.sendMessage(
            chatId,
            '1. <b>Название мероприятия:</b>\n\n' +
            'Пример: <i>"Концерт симфонического оркестра"</i>',
            {
                parse_mode: 'HTML',
                reply_markup: { force_reply: true }
            }
        );
        this.userStates[chatId].step = 'title';
    }

    async handleTitle(chatId, text) {
        if (!text || text.length < 3) {
            await this.bot.sendMessage(
                chatId,
                '❌ <b>Название слишком короткое</b>\n' +
                'Минимальная длина - 3 символа\n\n' +
                'Попробуйте еще раз:',
                { parse_mode: 'HTML' }
            );
            return true;
        }

        this.userStates[chatId].data.title = text;
        await this.askForDescription(chatId);
        return true;
    }

    async askForDescription(chatId) {
        await this.bot.sendMessage(
            chatId,
            '2. <b>Описание мероприятия:</b>\n\n' +
            'Пример: <i>"Выступление известного симфонического оркестра под управлением маэстро Иванова. В программе произведения Чайковского и Рахманинова."</i>',
            {
                parse_mode: 'HTML',
                reply_markup: { force_reply: true }
            }
        );
        this.userStates[chatId].step = 'description';
    }

    async handleDescription(chatId, text) {
        if (!text || text.length < 10) {
            await this.bot.sendMessage(
                chatId,
                '❌ <b>Описание слишком короткое</b>\n' +
                'Минимальная длина - 10 символов\n\n' +
                'Попробуйте еще раз:',
                { parse_mode: 'HTML' }
            );
            return true;
        }

        this.userStates[chatId].data.description = text;
        await this.askForDate(chatId);
        return true;
    }

    async askForDate(chatId) {
        await this.bot.sendMessage(
            chatId,
            '3. <b>Дата мероприятия:</b>\n\n' +
            'Формат: <code>ДД.ММ.ГГГГ</code>\n' +
            'Пример: <i>"15.12.2023"</i>',
            {
                parse_mode: 'HTML',
                reply_markup: { force_reply: true }
            }
        );
        this.userStates[chatId].step = 'date';
    }

    async handleDate(chatId, text) {
        if (!/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
            await this.bot.sendMessage(
                chatId,
                '❌ <b>Неверный формат даты</b>\n\n' +
                'Используйте формат: <code>ДД.ММ.ГГГГ</code>\n' +
                'Пример: <i>"15.12.2023"</i>',
                { parse_mode: 'HTML' }
            );
            return true;
        }

        this.userStates[chatId].data.date = text;
        await this.askForTime(chatId);
        return true;
    }

    async askForTime(chatId) {
        await this.bot.sendMessage(
            chatId,
            '4. <b>Время начала:</b>\n\n' +
            'Формат: <code>ЧЧ:ММ</code>\n' +
            'Пример: <i>"19:30"</i>',
            {
                parse_mode: 'HTML',
                reply_markup: { force_reply: true }
            }
        );
        this.userStates[chatId].step = 'time';
    }

    async handleTime(chatId, text) {
        if (!/^\d{2}:\d{2}$/.test(text)) {
            await this.bot.sendMessage(
                chatId,
                '❌ <b>Неверный формат времени</b>\n\n' +
                'Используйте формат: <code>ЧЧ:ММ</code>\n' +
                'Пример: <i>"19:30"</i>',
                { parse_mode: 'HTML' }
            );
            return true;
        }

        this.userStates[chatId].data.time = text;
        await this.askForPrice(chatId);
        return true;
    }

    async askForPrice(chatId) {
        await this.bot.sendMessage(
            chatId,
            '5. <b>Цена билета (руб):</b>\n\n' +
            'Пример: <i>"1500"</i> или <i>"2500.50"</i>',
            {
                parse_mode: 'HTML',
                reply_markup: { force_reply: true }
            }
        );
        this.userStates[chatId].step = 'price';
    }

    async handlePrice(chatId, text) {
        const price = parseFloat(text);
        if (isNaN(price)) {
            await this.bot.sendMessage(
                chatId,
                '❌ <b>Неверная цена</b>\n\n' +
                'Введите число. Например: <i>"1500"</i> или <i>"2500.50"</i>',
                { parse_mode: 'HTML' }
            );
            return true;
        }

        this.userStates[chatId].data.price = price;
        await this.askForImage(chatId);
        return true;
    }

    async askForImage(chatId) {
        await this.bot.sendMessage(
            chatId,
            '6. <b>Изображение для мероприятия:</b>\n\n' +
            'Пришлите фото или URL изображения\n' +
            'Пример URL: <i>"https://example.com/image.jpg"</i>',
            {
                parse_mode: 'HTML',
                reply_markup: { force_reply: true }
            }
        );
        this.userStates[chatId].step = 'image';
    }

    async handleImage(chatId, msg) {
        if (msg.photo && msg.photo.length > 0) {
            const photo = msg.photo[msg.photo.length - 1];
            this.userStates[chatId].data.image_url = await this.getFileUrl(photo.file_id);
            await this.askForLocation(chatId);
            return true;
        }

        const text = msg.text;
        if (!text || !text.startsWith('http')) {
            await this.bot.sendMessage(
                chatId,
                '❌ <b>Неверный URL или отсутствует изображение</b>\n\n' +
                'Пришлите изображение или корректную ссылку\n' +
                'Пример: <i>"https://example.com/image.jpg"</i>',
                { parse_mode: 'HTML' }
            );
            return true;
        }

        this.userStates[chatId].data.image_url = text;
        await this.askForLocation(chatId);
        return true;
    }

    async getFileUrl(fileId) {
        try {
            const file = await this.bot.getFile(fileId);
            return `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`;
        } catch (error) {
            console.error('Error getting file URL:', error);
            throw error;
        }
    }

    async askForLocation(chatId) {
        await this.bot.sendMessage(
            chatId,
            '7. <b>Место проведения:</b>\n\n' +
            'Пример: <i>"Концертный зал Филармония, ул. Музыкальная, 1"</i>',
            {
                parse_mode: 'HTML',
                reply_markup: { force_reply: true }
            }
        );
        this.userStates[chatId].step = 'location';
    }

    async handleLocation(chatId, text) {
        if (!text || text.length < 3) {
            await this.bot.sendMessage(
                chatId,
                '❌ <b>Название места слишком короткое</b>\n' +
                'Минимальная длина - 3 символа\n\n' +
                'Попробуйте еще раз:',
                { parse_mode: 'HTML' }
            );
            return true;
        }

        const userState = this.userStates[chatId];
        userState.data.event_location = text;

        const [day, month, year] = userState.data.date.split('.');
        const [hours, minutes] = userState.data.time.split(':');
        const eventDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`);

        try {
            const ticketData = {
                title: userState.data.title,
                description: userState.data.description,
                image_url: userState.data.image_url,
                event_date: eventDate,
                event_location: userState.data.event_location,
                price: userState.data.price
            };

            const newEvent = await this.eventService.createTicket(ticketData);
            delete this.userStates[chatId];

            const formattedDate = `${day}.${month}.${year}`;

            await this.bot.sendMessage(
                chatId,
                `🎉 <b>Мероприятие успешно создано!</b>\n\n` +
                `🎭 <b>${newEvent.title}</b>\n\n` +
                `📅 <b>Дата:</b> ${formattedDate} в ${userState.data.time}\n` +
                `📍 <b>Место:</b> ${newEvent.event_location}\n` +
                `💰 <b>Цена:</b> ${newEvent.price} руб.\n\n` +
                `🆔 <b>ID мероприятия:</b> <code>${newEvent.id}</code>`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Вернуться в меню админа', callback_data: 'admin_tickets' }]
                        ]
                    }
                }
            );

            return true;
        } catch (error) {
            console.error('Event creation error:', error);
            await this.bot.sendMessage(
                chatId,
                '⚠️ <b>Ошибка при создании мероприятия</b>\n' +
                'Попробуйте позже или обратитесь к разработчику',
                { parse_mode: 'HTML' }
            );
            delete this.userStates[chatId];
            return true;
        }
    }
}