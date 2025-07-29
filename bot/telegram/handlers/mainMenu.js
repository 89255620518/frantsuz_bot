import { bot } from '../botInstance.js';
import { User } from '../../models/User.js';
import { refundRules } from '../rules/refundRules.js';

// Флаг для предотвращения дублирования меню
const menuShown = new Set();

const menuController = {
    /**
     * Отображает главное меню с интерактивными кнопками
     * @param {number} chatId - ID чата
     * @param {boolean} isAdmin - Флаг администратора
     */
    showMainMenu: async (chatId, isAdmin = false) => {
        if (menuShown.has(chatId)) return;
        menuShown.add(chatId);

        try {
            const menuButtons = [
                [
                    { text: '🍽️ Меню', web_app: { url: process.env.WEB_APP_URL_MENU } },
                    { text: '🎯 Бильярд', web_app: { url: process.env.WEB_APP_URL_BILLARD } },
                ],
                [
                    { text: '💿 Диско-бар', web_app: { url: process.env.WEB_APP_URL_dISCO } },
                    { text: '🎤 Караоке', web_app: { url: process.env.WEB_APP_URL_CARAOKE } }
                ],
                [
                    { text: '🛋️ Лаунж зона', web_app: { url: process.env.WEB_APP_URL_LAUNZH } },
                    { text: '🎮 Playstation', web_app: { url: process.env.WEB_APP_URL_PLAYSTATIONS } }
                ],
                [
                    { text: '🎲 Настольные игры', web_app: { url: process.env.WEB_APP_URL_TABLEPLAY } },
                    { text: '📅 Афиша', web_app: { url: process.env.WEB_APP_URL_AFISHA } },
                ],
                [
                    { text: '🛎️ Бронирование', web_app: { url: process.env.WEB_APP_URL_RESERVE } },
                    { text: '🎟️ Билеты', callback_data: 'show_tickets' }
                ],
                // Утилиты
                [
                    { text: '💳 Оплата', callback_data: 'pay' },
                    { text: '📞 Контакты', callback_data: 'contacts' }
                ],
                // Информация
                [
                    { text: '📝 Правила оплаты', callback_data: 'pay_rules' },
                    { text: '↩️ Правила возврата', callback_data: 'refund' }
                ]
            ];

            // Админ-панель
            if (isAdmin) {
                menuButtons.push([
                    { text: '🛠️ Управление билетами', callback_data: 'admin_tickets' },
                    { text: '⚙️ Админ-панель', callback_data: 'admin_panel' }
                ]);
            }

            await bot.sendMessage(chatId, '👇 Выберите раздел:', {
                reply_markup: { inline_keyboard: menuButtons }
            });

            setTimeout(() => menuShown.delete(chatId), 5000);
        } catch (error) {
            console.error('Menu display error:', error);
            menuShown.delete(chatId);
        }
    },

    /**
     * Обрабатывает команду /start
     * @param {Object} msg - Объект сообщения Telegram
     */
    handleStartCommand: async (msg) => {
        const chatId = msg.chat?.id;
        const user = msg.from;

        if (!chatId || !user?.id) {
            console.error('Invalid message structure:', msg);
            return bot.sendMessage(
                chatId || user?.id,
                '⚠️ Не удалось получить данные вашего профиля. Пожалуйста, попробуйте еще раз.'
            );
        }

        try {
            const result = await User.findOrCreateFromTelegram(user);
            if (!result?.user) throw new Error('User creation failed');

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

            await bot.sendMessage(chatId, welcomeText);
            await menuController.showMainMenu(chatId, dbUser.is_admin);

        } catch (error) {
            console.error('Start command error:', error);
            await bot.sendMessage(chatId, '⚠️ Произошла ошибка при обработке команды. Пожалуйста, попробуйте позже.');
        }
    },

    /**
     * Настраивает команды бота
     */
    setupBotCommands: () => {
        const commands = [
            { command: '/start', description: 'Начать работу с ботом' },
            { command: '/menu', description: 'Меню бара и кухни' },
            { command: '/billiard', description: 'Бильярд' },
            { command: '/karaoke', description: 'Караоке' },
            { command: '/disco', description: 'Диско-бар' },
            { command: '/lounge', description: 'Лаунж зона' },
            { command: '/playstation', description: 'Игровые приставки' },
            { command: '/games', description: 'Настольные игры' },
            { command: '/show_tickets', description: 'Купить билеты' },
            { command: '/events', description: 'Афиша мероприятий' },
            { command: '/pay', description: 'Оплата' },
            { command: '/pay_rules', description: 'Правила оплаты' },
            { command: '/refund', description: 'Правила возврата' },
            { command: '/reserve', description: 'Бронирование' },
            { command: '/contacts', description: 'Контакты' }
        ];

        return bot.setMyCommands(commands)
            .then(() => console.log('Командное меню успешно настроено'))
            .catch(err => {
                console.error('Ошибка настройки команд:', err);
                throw err;
            });
    }
};

// Инициализация команд при старте
menuController.setupBotCommands();

// Экспортируем как именованные экспорты и default
export const { showMainMenu, handleStartCommand, setupBotCommands } = menuController;
export default menuController;