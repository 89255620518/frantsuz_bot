import { bot } from '../botInstance.js';
import { userStates } from '../../state.js';
import { User } from '../../models/User.js';
import { events } from '../../../data/events.js';
import { processPayment } from '../../services/paykeeper.js';

export const showEventsList = async (chatId) => {
    if (!events?.length) {
        return bot.sendMessage(chatId, '🎭 В данный момент нет доступных мероприятий. Следите за обновлениями!');
    }

    await bot.sendMessage(chatId, '🎟️ Доступные мероприятия:');

    for (const event of events) {
        if (!event.id || !event.title) continue;

        const caption = `🎟️ *${event.title}*\n📅 ${event.date || 'Дата не указана'} в ${event.time || 'время не указано'}\n📍 ${event.location || 'Место не указано'}\n💰 ${event.price || 'Цена не указана'} руб.\n\n${event.description || ''}`;

        await bot.sendPhoto(chatId, event.image || 'https://via.placeholder.com/500', {
            caption,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Купить билет', callback_data: `buy_ticket_${event.id}` }]
                ]
            }
        });
    }
};

export const startTicketPurchase = async (chatId, eventId, userId) => {
    try {
        const event = events.find(e => e.id === eventId);
        if (!event) {
            return bot.sendMessage(chatId, '❌ Мероприятие не найдено.');
        }

        const user = await User.findOne({ where: { telegram_id: userId || chatId } });
        if (!user) {
            return bot.sendMessage(chatId, '❌ Пожалуйста, сначала нажмите /start');
        }

        userStates[chatId] = {
            eventId: event.id,
            step: 'name',
            eventData: event,
            dbUserId: user.telegram_id
        };

        await bot.sendMessage(
            chatId,
            `🎟️ *Оформление билета*\n\n` +
            `🎭 *${event.title}*\n` +
            `📅 ${event.date || 'Дата не указана'} в ${event.time || 'время не указано'}\n` +
            `📍 ${event.location || 'Место не указано'}\n` +
            `💰 *${event.price || 'Цена не указана'} руб.*\n\n` +
            `Пожалуйста, введите ваше *имя и фамилию*:`,
            { parse_mode: 'Markdown', reply_markup: { force_reply: true } }
        );

    } catch (error) {
        console.error('Ошибка при начале покупки билета:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
};

export const completeTicketPurchase = async (chatId, userState) => {
    try {
        const user = await User.findOne({ where: { telegram_id: userState.dbUserId } });
        if (!user) {
            throw new Error('Пользователь не найден');
        }

        await user.update({
            phone: userState.phone,
            email: userState.email
        });

        const ticketNumber = `FR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const ticketData = {
            number: ticketNumber,
            event: userState.eventData,
            customer: {
                name: userState.name,
                phone: userState.phone,
                email: userState.email,
            },
            price: userState.eventData.price
        };

        await bot.sendMessage(
            chatId,
            '🔄 *Создаем ваш билет...*\n\nПожалуйста, подождите несколько секунд.',
            { parse_mode: 'Markdown' }
        );

        const paymentResult = await processPayment(bot, chatId, ticketData);

        if (!paymentResult.success) {
            throw new Error('Ошибка создания платежа');
        }

    } catch (error) {
        console.error('Ошибка оформления билета:', error);
        await bot.sendMessage(
            chatId,
            '❌ *Ошибка оформления билета*\n\nПожалуйста, попробуйте позже или обратитесь в поддержку:\n📞 +7(968)090-55-50',
            { parse_mode: 'Markdown' }
        );
    } finally {
        delete userStates[chatId];
    }
};

export const handleTicketsCommand = (msg) => {
    if (msg?.chat?.id) showEventsList(msg.chat.id);
};