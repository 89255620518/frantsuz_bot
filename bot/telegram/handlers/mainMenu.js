import { bot } from '../botInstance.js';
import { User } from '../../models/User.js';

// Добавим флаг для отслеживания показа меню
const menuShown = new Set();

export const showMainMenu = async (chatId, isAdmin = false) => {
    // Проверяем, не показывали ли уже меню этому чату
    if (menuShown.has(chatId)) {
        return;
    }
    menuShown.add(chatId);

    try {
        const buttons = [
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
        ];

        if (isAdmin) {
            buttons.push([
                { text: '🛠️ Управление билетами', callback_data: 'admin_tickets' }
            ]);
        }

        await bot.sendMessage(chatId, '👇 Выберите раздел:', {
            reply_markup: {
                inline_keyboard: buttons
            }
        });

        // Через 5 секунд разрешаем показ меню снова
        setTimeout(() => menuShown.delete(chatId), 5000);
    } catch (error) {
        console.error('Error showing main menu:', error);
        menuShown.delete(chatId);
    }
};

export const handleStartCommand = async (msg) => {
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

        const isAdmin = dbUser.is_admin;

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

        await bot.sendMessage(chatId, welcomeText);
        await showMainMenu(chatId, isAdmin);

    } catch (error) {
        console.error('Ошибка в /start:', error);
        await bot.sendMessage(chatId, '⚠️ Произошла ошибка при обработке команды. Пожалуйста, попробуйте позже.');
    }
};