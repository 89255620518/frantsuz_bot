import { User } from '../models/User.js';
import { bot } from './botInstance.js';
import { events } from '../../data/events.js';
import { userStates } from '../state.js';
import { processPayment, checkPaymentStatus } from '../services/paykeeper.js';

// Вспомогательные функции
const showMainMenu = async (chatId) => {
    await bot.sendMessage(chatId, '👇 Выберите раздел:', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🍽️ Меню', web_app: { url: process.env.WEB_APP_URL_MENU } },
                    { text: '🎯 Бильярд', web_app: { url: process.env.WEB_APP_URL_BILLARD } }
                ],
                [
                    { text: '🎤 Караоке', web_app: { url: process.env.WEB_APP_URL_CARAOKE } },
                    { text: '💿 Диско-бар', web_app: { url: process.env.WEB_APP_URL_dISCO } }
                ],
                [
                    { text: '🛋️ Лаунж зона', web_app: { url: process.env.WEB_APP_URL_LAUNZH } },
                    { text: '🎮 Playstation', web_app: { url: process.env.WEB_APP_URL_PLAYSTATIONS } }
                ],
                [
                    { text: '🎲 Настольные игры', web_app: { url: process.env.WEB_APP_URL_TABLEPLAY } },
                    { text: '🎟️ Купить билеты', callback_data: 'show_tickets' }
                ],
                [
                    { text: '🛎️ Бронирование', web_app: { url: process.env.WEB_APP_URL_RESERVE } },
                    { text: '📞 Контакты', callback_data: 'contacts' }
                ]
            ]
        }
    });
};

const showEventsList = async (chatId) => {
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

const startTicketPurchase = async (chatId, eventId, userId) => {
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

const completeTicketPurchase = async (chatId, userState) => {
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

const showContacts = async (chatId) => {
    const contactsText = `📞 Контакты клуба "Француз":

📍 Адрес: г. Москва, ул. Салтыковская, 49А
☎ Телефон: +7(968) 090-55-50
📱 Банкетный менеджер: +7(968) 091-55-50
✉ Email: order@wetop.ru

🕒 Часы работы: 
Пн-Чт: с 12:00 до 00:00
Пт-Сб: с 12:00 до 02:00
Вс: с 12:00 до 00:00`;

    await bot.sendMessage(chatId, contactsText, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Открыть карту', url: 'https://yandex.ru/maps/-/CDqZIVX8' }]
            ]
        }
    });
};

// Основные обработчики
export const setupEventHandlers = () => {
    // Обработчик /start (сохранен оригинальный)
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat?.id;
        const user = msg.from;

        if (!chatId || !user?.id) {
            console.error('Invalid message structure:', { msg });
            return bot.sendMessage(
                chatId || user?.id,
                '⚠️ Не удалось получить данные вашего профиля. Пожалуйста, попробуйте еще раз.'
            );
        }

        try {
            const result = await User.findOrCreateFromTelegram(user);
            if (!result || !result.user) {
                throw new Error('Failed to create or find user');
            }

            const { user: dbUser, created } = result;
            
            console.log(`User ${created ? 'created' : 'updated'}:`, {
                id: dbUser.telegram_id,
                username: dbUser.username,
                first_name: dbUser.first_name
            });

            const welcomeText = `
            🎭 ${created ? 'Добро пожаловать' : 'С возвращением'}, ${dbUser.first_name} в Развлекательный клуб "Француз"!

            ✨ ${created ? 'Вы успешно зарегистрированы!' : 'Рады видеть вас снова!'}

            🎉 Ваш идеальный вечер начинается здесь:

            • 🎯 Бильярд для истинных ценителей
            • 🎤 Караоке с обширной коллекцией песен
            • 🎮 Игровые приставки для дружеских баталий
            • 🎲 Настольные игры для компании любого размера
            • 💿 Диско-бар с лучшими DJ
            • 🛋️ Лаунж зона для уютных посиделок
            • 🍽️ Бар и кухня с изысканными блюдами

            👇 Выберите раздел, который вас интересует:
                `;

            await bot.sendMessage(chatId, welcomeText, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🍽️ Меню', web_app: { url: process.env.WEB_APP_URL_MENU } },
                            { text: '🎯 Бильярд', web_app: { url: process.env.WEB_APP_URL_BILLARD } }
                        ],
                        [
                            { text: '🎤 Караоке', web_app: { url: process.env.WEB_APP_URL_CARAOKE } },
                            { text: '💿 Диско-бар', web_app: { url: process.env.WEB_APP_URL_dISCO } }
                        ],
                        [
                            { text: '🛋️ Лаунж зона', web_app: { url: process.env.WEB_APP_URL_LAUNZH } },
                            { text: '🎮 Playstation', web_app: { url: process.env.WEB_APP_URL_PLAYSTATIONS } }
                        ],
                        [
                            { text: '🎲 Настольные игры', web_app: { url: process.env.WEB_APP_URL_TABLEPLAY } },
                            { text: '🎟️ Купить билеты', callback_data: 'show_tickets' }
                        ],
                        [
                            { text: '🛎️ Бронирование', web_app: { url: process.env.WEB_APP_URL_RESERVE } },
                            { text: '📞 Контакты', callback_data: 'contacts' }
                        ]
                    ]
                }
            });

        } catch (error) {
            console.error('Ошибка в /start:', error);
            await bot.sendMessage(chatId, '⚠️ Произошла ошибка при обработке команды. Пожалуйста, попробуйте позже.');
        }
    });

    // Обработчик /tickets
    bot.onText(/\/tickets/, (msg) => {
        if (msg?.chat?.id) showEventsList(msg.chat.id);
    });

    // Обработчик callback_query
    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        if (!msg?.chat?.id) return;

        const chatId = msg.chat.id;
        const data = callbackQuery.data;
        const user = callbackQuery.from;

        try {
            if (!data) {
                await bot.answerCallbackQuery(callbackQuery.id);
                return;
            }

            if (data === 'contacts') {
                await showContacts(chatId);
            }
            else if (data === 'show_tickets') {
                await showEventsList(chatId);
            }
            else if (data.startsWith('buy_ticket_')) {
                const eventId = parseInt(data.split('_')[2]);
                if (!isNaN(eventId)) {
                    await startTicketPurchase(chatId, eventId, user?.id);
                }
            }
            else if (data.startsWith('check_payment_')) {
                const invoiceId = data.split('_')[2];
                if (invoiceId) {
                    await checkPaymentStatus(bot, chatId, invoiceId);
                }
            }
            else if (data === 'cancel_payment') {
                delete userStates[chatId];
                await bot.sendMessage(
                    chatId,
                    '💔 *Очень жаль, что вы не оформили билет!*\n\nВозможно, вы передумаете? Мы будем рады видеть вас!',
                    { parse_mode: 'Markdown' }
                );
                setTimeout(() => showMainMenu(chatId), 3000);
            }

            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('Error in callback:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
        }
    });

    // Обработчик сообщений
    bot.on('message', async (msg) => {
        if (!msg?.chat?.id || !msg.text || msg.text.startsWith('/')) return;

        const chatId = msg.chat.id;
        const userState = userStates[chatId];
        if (!userState) return;

        try {
            if (userState.step === 'name') {
                const nameParts = msg.text.trim().split(/\s+/);
                if (nameParts.length < 2) {
                    return bot.sendMessage(chatId, '❌ Пожалуйста, введите имя и фамилию через пробел');
                }

                userState.name = msg.text;
                userState.step = 'phone';
                await bot.sendMessage(chatId, '📞 Введите ваш номер телефона в формате +7XXXXXXXXXX:', {
                    reply_markup: { force_reply: true }
                });
            }
            else if (userState.step === 'phone') {
                const phoneRegex = /^(\+7|8)[0-9]{10}$/;
                const cleanPhone = msg.text.replace(/[^\d+]/g, '');

                if (!phoneRegex.test(cleanPhone)) {
                    return bot.sendMessage(chatId, '❌ Неверный формат телефона. Введите в формате +7XXXXXXXXXX');
                }

                userState.phone = cleanPhone;
                userState.step = 'email';
                await bot.sendMessage(chatId, '📧 Введите ваш email (на него будет отправлен билет):', {
                    reply_markup: { force_reply: true }
                });
            }
            else if (userState.step === 'email') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(msg.text)) {
                    return bot.sendMessage(chatId, '❌ Неверный формат email. Пожалуйста, введите корректный email');
                }

                userState.email = msg.text;
                await completeTicketPurchase(chatId, userState);
            }
        } catch (error) {
            console.error('Error in message handler:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
        }
    });
};