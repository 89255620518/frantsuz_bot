import { events } from './events.js';
import { userStates } from './state.js';
import { processPayment } from './payment/paykeeper.js';
import { bot } from './index.js';

export const showEventsList = async (chatId) => {
    try {
        if (!events?.length) {
            await bot.sendMessage(
                chatId,
                '🎭 В данный момент нет доступных мероприятий.\n\nСледите за обновлениями!'
            );
            return;
        }

        await bot.sendMessage(chatId, '🎟️ <b>Ближайшие мероприятия:</b>', { parse_mode: 'HTML' });

        for (const event of events) {
            try {
                await bot.sendPhoto(
                    chatId,
                    event.image,
                    {
                        caption: `🎭 <b>${event.title}</b>\n\n` +
                            `📅 ${event.date} в ${event.time}\n` +
                            `📍 ${event.location}\n` +
                            `💰 ${event.price} руб.\n\n` +
                            `${event.description}\n\n` +
                            `👇 Нажмите кнопку ниже чтобы купить билет`,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Купить билет', callback_data: `buy_ticket_${event.id}` }]
                            ]
                        }
                    }
                );
            } catch (error) {
                console.error(`Ошибка отправки мероприятия ${event.id}:`, error);
                await bot.sendMessage(
                    chatId,
                    `🎭 <b>${event.title}</b>\n\n` +
                    `📅 ${event.date} в ${event.time}\n` +
                    `💰 ${event.price} руб.\n\n` +
                    `👇 Нажмите кнопку чтобы купить билет`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Купить билет', callback_data: `buy_ticket_${event.id}` }]
                            ]
                        }
                    }
                );
            }
        }
    } catch (error) {
        console.error('Ошибка показа мероприятий:', error);
        await bot.sendMessage(chatId, '⚠️ Не удалось загрузить список мероприятий.\nПопробуйте позже.');
    }
};

export const startTicketPurchase = async (chatId, eventId) => {
    try {
        const event = events.find(e => e.id === eventId);
        if (!event) {
            await bot.sendMessage(chatId, '❌ Мероприятие не найдено.\nПожалуйста, выберите другое.');
            return;
        }

        userStates[chatId] = {
            eventId: event.id,
            step: 'name',
            eventData: {
                title: event.title,
                date: event.date,
                time: event.time,
                location: event.location,
                price: event.price
            },
            createdAt: Date.now()
        };

        await bot.sendMessage(
            chatId,
            `🎟️ <b>Оформление билета:</b>\n\n` +
            `🎭 ${event.title}\n` +
            `📅 ${event.date} в ${event.time}\n` +
            `💰 ${event.price} руб.\n\n` +
            `👇 Введите ваше <b>имя и фамилию</b>:`,
            { parse_mode: 'HTML', reply_markup: { force_reply: true } }
        );

    } catch (error) {
        console.error('Ошибка начала оформления:', error);
        await bot.sendMessage(chatId, '⚠️ Ошибка при начале оформления.\nПопробуйте позже.');
    }
};

export const handleTicketSteps = async (chatId, text) => {
    if (!text || text.startsWith('/')) return;

    const userState = userStates[chatId];
    if (!userState) return;

    try {
        switch (userState.step) {
            case 'name': await processNameStep(chatId, text, userState); break;
            case 'phone': await processPhoneStep(chatId, text, userState); break;
            case 'email': await processEmailStep(chatId, text, userState); break;
        }
    } catch (error) {
        console.error('Ошибка обработки шага:', error);
        await bot.sendMessage(chatId, '⚠️ Произошла ошибка.\nПожалуйста, начните оформление заново.');
        delete userStates[chatId];
    }
};

async function processNameStep(chatId, text, userState) {
    const name = text.trim();
    if (name.length < 2) {
        await bot.sendMessage(
            chatId,
            '❌ Имя слишком короткое.\nВведите ваше имя и фамилию:',
            { reply_markup: { force_reply: true } }
        );
        return;
    }

    userState.name = name;
    userState.step = 'phone';

    await bot.sendMessage(
        chatId,
        '📞 Введите ваш <b>номер телефона</b>:\n\nПример: <code>+79161234567</code>',
        { parse_mode: 'HTML', reply_markup: { force_reply: true } }
    );
}

async function processPhoneStep(chatId, text, userState) {
    const phone = text.replace(/[^\d+]/g, '');
    if (phone.length < 10 || !phone.match(/^(\+?\d{10,15})$/)) {
        await bot.sendMessage(
            chatId,
            '❌ Неверный формат телефона.\nВведите корректный номер:\n\nПример: <code>+79161234567</code>',
            { parse_mode: 'HTML', reply_markup: { force_reply: true } }
        );
        return;
    }

    userState.phone = phone;
    userState.step = 'email';

    await bot.sendMessage(
        chatId,
        '📧 Введите ваш <b>email</b> (необязательно):',
        { parse_mode: 'HTML', reply_markup: { force_reply: true } }
    );
}

async function processEmailStep(chatId, text, userState) {
    const email = text.trim();
    if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        await bot.sendMessage(
            chatId,
            '❌ Неверный формат email.\nВведите корректный email или пропустите этот шаг:',
            { reply_markup: { force_reply: true } }
        );
        return;
    }

    userState.email = email || '';
    await completeTicketPurchase(chatId, userState);
}

async function completeTicketPurchase(chatId, userState) {
    try {
        const ticketNumber = generateTicketNumber();
        const ticketData = {
            number: ticketNumber,
            event: userState.eventData,
            customer: {
                name: userState.name,
                phone: userState.phone,
                email: userState.email || `${ticketNumber}@ticket.frantsuz`
            },
            price: userState.eventData.price
        };

        await bot.sendMessage(chatId, '🔄 Создаем ваш билет...', { parse_mode: 'HTML' });
        const paymentSuccess = await processPayment(bot, chatId, ticketData);

        if (!paymentSuccess) throw new Error('Не удалось создать платеж');
        console.log(`Успешно оформлен билет ${ticketNumber} для ${chatId}`);

    } catch (error) {
        console.error('Ошибка завершения оформления:', error);
        await bot.sendMessage(
            chatId,
            '❌ <b>Ошибка оформления билета</b>\n\nПожалуйста, попробуйте позже или обратитесь в поддержку.',
            { parse_mode: 'HTML' }
        );
    } finally {
        delete userStates[chatId];
    }
}

function generateTicketNumber() {
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `FR-${datePart}-${randomPart}`;
}