import { bot } from '../botInstance.js';
import { User } from '../../models/User.js';

// Флаг для предотвращения дублирования меню
const menuShown = new Set();

// Общая функция для проверки/регистрации пользователя
async function ensureUserRegistered(msg) {
    const chatId = msg.chat?.id;
    const user = msg.from;

    if (!chatId || !user?.id) {
        console.error('Invalid message structure:', msg);
        throw new Error('Не удалось получить данные профиля');
    }

    const result = await User.findOrCreateFromTelegram(user);
    if (!result?.user) throw new Error('User creation failed');
    
    return result.user;
}

const menuController = {
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
                [
                    { text: '💳 Оплата', callback_data: 'pay' },
                    { text: '📞 Контакты', callback_data: 'contacts' }
                ],
                [
                    { text: '📝 Правила оплаты', callback_data: 'pay_rules' },
                    { text: '↩️ Правила возврата', callback_data: 'refund' }
                ]
            ];

            if (isAdmin) {
                menuButtons.push([
                    { text: '🛠️ Управление билетами', callback_data: 'admin_tickets' },
                    { text: '⚙️ Статистика', callback_data: 'admin_panel' },
                    { text: '🔙 Возвраты', callback_data: 'admin_refund' }
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

    handleStartCommand: async (msg) => {
        const chatId = msg.chat?.id;
        
        try {
            const dbUser = await ensureUserRegistered(msg);
            
            const welcomeText = `
            🎭 ${dbUser.created_at.getTime() > Date.now() - 60000 ? 'Добро пожаловать' : 'С возвращением'}, ${dbUser.first_name} в развлекательный комплекс "Француз"!

            ✨ ${dbUser.created_at.getTime() > Date.now() - 60000 ? 'Вы успешно зарегистрированы!' : 'Рады видеть вас снова!'}

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

        // Обработчики для всех команд
        commands.forEach(cmd => {
            if (cmd.command !== '/start') {
                bot.onText(new RegExp(`^${cmd.command}$`), async (msg) => {
                    try {
                        const dbUser = await ensureUserRegistered(msg);
                        await menuController.showMainMenu(msg.chat.id, dbUser.is_admin);
                    } catch (error) {
                        console.error(`Command ${cmd.command} error:`, error);
                        await bot.sendMessage(msg.chat.id, '⚠️ Произошла ошибка. Пожалуйста, попробуйте позже.');
                    }
                });
            }
        });

        return bot.setMyCommands(commands)
            .then(() => console.log('Командное меню успешно настроено'))
            .catch(err => {
                console.error('Ошибка настройки команд:', err);
                throw err;
            });
    },

    // Обработчик для inline-кнопок
    setupInlineHandlers: () => {
        const callbackQueries = [
            'show_tickets', 'pay', 'contacts', 'pay_rules', 'refund',
            'admin_tickets', 'admin_panel'
        ];

        callbackQueries.forEach(query => {
            bot.on('callback_query', async (callbackQuery) => {
                if (callbackQuery.data === query) {
                    try {
                        const dbUser = await ensureUserRegistered(callbackQuery.message);
                        await menuController.showMainMenu(callbackQuery.message.chat.id, dbUser.is_admin);
                    } catch (error) {
                        console.error(`Callback ${query} error:`, error);
                        await bot.answerCallbackQuery(callbackQuery.id, {
                            text: '⚠️ Ошибка обработки запроса',
                            show_alert: true
                        });
                    }
                }
            });
        });
    }
};

// Инициализация
menuController.setupBotCommands();
menuController.setupInlineHandlers();

export const { showMainMenu, handleStartCommand, setupBotCommands } = menuController;
export default menuController;