export class EventWizard {
    constructor(bot, ticketService, userStates) {
        this.bot = bot;
        this.ticketService = ticketService;
        this.userStates = userStates;
    }

    async startCreation(chatId) {
        await this.bot.sendMessage(chatId, 'Давайте создадим новое событие. Вводите данные по шагам:');

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
                case 'image': return this.handleImage(chatId, text);
                case 'location': return this.handleLocation(chatId, text);
                default: return false;
            }
        } catch (error) {
            console.error('EventWizard error:', error);
            await this.bot.sendMessage(chatId, '⚠️ Произошла ошибка. Попробуйте еще раз.');
            delete this.userStates[chatId];
            return true;
        }
    }

    async askForTitle(chatId) {
        await this.bot.sendMessage(chatId, '1. Введите название события:', {
            reply_markup: { force_reply: true }
        });
        this.userStates[chatId].step = 'title';
    }

    async handleTitle(chatId, text) {
        if (!text || text.length < 3) {
            await this.bot.sendMessage(chatId, '❌ Название слишком короткое. Введите еще раз:');
            return true;
        }

        this.userStates[chatId].data.title = text;
        await this.askForDescription(chatId);
        return true;
    }

    async askForDescription(chatId) {
        await this.bot.sendMessage(chatId, '2. Введите описание события:', {
            reply_markup: { force_reply: true }
        });
        this.userStates[chatId].step = 'description';
    }

    async handleDescription(chatId, text) {
        if (!text || text.length < 10) {
            await this.bot.sendMessage(chatId, '❌ Описание слишком короткое. Введите еще раз:');
            return true;
        }

        this.userStates[chatId].data.description = text;
        await this.askForDate(chatId);
        return true;
    }

    async askForDate(chatId) {
        await this.bot.sendMessage(chatId, '3. Введите дату события (ДД.ММ.ГГГГ):', {
            reply_markup: { force_reply: true }
        });
        this.userStates[chatId].step = 'date';
    }

    async handleDate(chatId, text) {
        if (!/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
            await this.bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте ДД.ММ.ГГГГ:');
            return true;
        }

        this.userStates[chatId].data.date = text;
        await this.askForTime(chatId);
        return true;
    }

    async askForTime(chatId) {
        await this.bot.sendMessage(chatId, '4. Введите время начала (ЧЧ:ММ):', {
            reply_markup: { force_reply: true }
        });
        this.userStates[chatId].step = 'time';
    }

    async handleTime(chatId, text) {
        if (!/^\d{2}:\d{2}$/.test(text)) {
            await this.bot.sendMessage(chatId, '❌ Неверный формат времени. Используйте ЧЧ:ММ:');
            return true;
        }

        this.userStates[chatId].data.time = text;
        await this.askForPrice(chatId);
        return true;
    }

    async askForPrice(chatId) {
        await this.bot.sendMessage(chatId, '5. Введите цену билета (руб):', {
            reply_markup: { force_reply: true }
        });
        this.userStates[chatId].step = 'price';
    }

    async handlePrice(chatId, text) {
        const price = parseFloat(text);
        if (isNaN(price)) {
            await this.bot.sendMessage(chatId, '❌ Неверная цена. Введите число:');
            return true;
        }

        this.userStates[chatId].data.price = price;
        await this.askForImage(chatId);
        return true;
    }

    async askForImage(chatId) {
        await this.bot.sendMessage(chatId, '6. Пришлите URL изображения:', {
            reply_markup: { force_reply: true }
        });
        this.userStates[chatId].step = 'image';
    }

    async handleImage(chatId, text) {
        if (!text || !text.startsWith('http')) {
            await this.bot.sendMessage(chatId, '❌ Неверный URL. Введите корректную ссылку:');
            return true;
        }

        this.userStates[chatId].data.image_url = text;
        await this.askForLocation(chatId);
        return true;
    }

    async askForLocation(chatId) {
        await this.bot.sendMessage(chatId, '7. Введите место проведения:', {
            reply_markup: { force_reply: true }
        });
        this.userStates[chatId].step = 'location';
    }

    async handleLocation(chatId, text) {
        if (!text || text.length < 3) {
            await this.bot.sendMessage(chatId, '❌ Название места слишком короткое. Введите еще раз:');
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
                event_date: eventDate, // Передаем объект Date
                event_location: userState.data.event_location,
                price: userState.data.price
                // ticket_number и is_used будут сгенерированы автоматически
            };

            const newEvent = await this.ticketService.createTicket(ticketData);
            delete this.userStates[chatId];

            const formattedDate = `${day}.${month}.${year}`;

            await this.bot.sendMessage(chatId, 
                `✅ Событие создано!\n\n` +
                `🎭 <b>${newEvent.title}</b>\n` +
                `📅 ${formattedDate} в ${userState.data.time}\n` +
                `📍 ${newEvent.event_location}\n` +
                `💵 ${newEvent.price} руб.\n\n` +
                `ID: ${newEvent.id}`,
                { parse_mode: 'HTML' }
            );
            
            return true;
        } catch (error) {
            console.error('Event creation error:', error);
            await this.bot.sendMessage(chatId, '⚠️ Ошибка при создании события');
            delete this.userStates[chatId];
            return true;
        }
    }
}