import { UserTicket } from '../../../models/UserTicket.js';
import { Ticket } from '../../../models/Event.js';
import { Order } from '../../../models/Orders.js';
import { bot } from '../../botInstance.js';
import { userStates } from '../../../state.js';
import { ButtonTrackingService } from '../../../services/ButtonTrackingService.js';

// Выносим функции форматирования в начало модуля
const formatAdminMessage = (eventsStats, customersData, generalStats, buttonStats) => {
    let message = '✨ ПАНЕЛЬ АДМИНИСТРАТОРА ✨\n\n';
    
    message += '📊 ОБЩАЯ СТАТИСТИКА\n';
    message += '┌──────────────────────────────┐\n';
    message += `│ 🎫 Всего билетов: ${generalStats.total.toString().padEnd(8)} │\n`;
    message += `│ ✅ Использовано:  ${generalStats.used.toString().padEnd(8)} │\n`;
    message += `│ 🔥 Активные:      ${generalStats.active.toString().padEnd(8)} │\n`;
    message += `│ ⏳ Ожидают оплаты:${generalStats.pending.toString().padEnd(8)} │\n`;
    message += '└──────────────────────────────┘\n\n';

    message += '🖱 СТАТИСТИКА КЛИКОВ\n';
    message += '┌──────────────────────────────┐\n';
    message += `│ 👆 Всего кликов: ${buttonStats.totalClicks.toString().padEnd(8)} │\n`;
    message += `│ 🎯 Уникальных кнопок: ${buttonStats.uniqueButtons.toString().padEnd(4)} │\n`;
    message += '├──────────────────────────────┤\n';

    const topButtons = [...buttonStats.allButtons].sort((a, b) => b.count - a.count).slice(0, 5);
    topButtons.forEach(button => {
        message += `│ 🔘 ${button.buttonId.padEnd(15)} ${button.count.toString().padEnd(5)} │\n`;
    });
    message += '└──────────────────────────────┘\n\n';

    message += '🎭 МЕРОПРИЯТИЯ\n';
    eventsStats.forEach(event => {
        message += `\n🎪 ${event.title}\n`;
        message += '┌──────────────────────────────┐\n';
        message += `│ 🎫 Всего: ${event.total.toString().padEnd(8)} │ 🏷 Использовано ${event.used.toString().padEnd(5)} │\n`;
        message += `│ 🟢 Активные: ${event.active.toString().padEnd(6)} │ 💰 Оплачено ${event.paid.toString().padEnd(8)} │\n`;
        message += '└──────────────────────────────┘\n';
    });

    message += `\n👥 ПОКУПАТЕЛИ (${customersData.length})\n`;
    customersData.slice(0, 5).forEach((customer, index) => {
        message += `\n${index + 1}. 👤 ${customer.first_name} ${customer.last_name}\n`;
        message += `   📞 ${customer.phone || 'Не указан'}\n`;
        message += `   📧 ${customer.email || 'Не указан'}\n`;
        message += `   🎟 Билетов: ${customer.tickets_count} шт | 🛒 Заказов: ${customer.orders_count}\n`;
    });

    if (customersData.length > 5) {
        message += `\n...и ещё ${customersData.length - 5} покупателей`;
    }

    return message;
};

const formatFullStatsMessage = (eventsStats, customersData, generalStats, buttonStats) => {
    let message = '📈 ПОЛНАЯ СТАТИСТИКА СИСТЕМЫ 📉\n\n';

    message += '📊 ОБЩАЯ СТАТИСТИКА\n';
    message += '┌──────────────────────────────┐\n';
    message += `│ 🎫 Всего билетов: ${generalStats.total.toString().padEnd(8)} │\n`;
    message += `│ ✅ Использовано:  ${generalStats.used.toString().padEnd(8)} │\n`;
    message += `│ 🔥 Активные:      ${generalStats.active.toString().padEnd(8)} │\n`;
    message += `│ ⏳ Ожидают оплаты:${generalStats.pending.toString().padEnd(8)} │\n`;
    message += '└──────────────────────────────┘\n\n';

    message += '🖱 ПОЛНАЯ СТАТИСТИКА КЛИКОВ\n';
    message += '┌──────────────────────────────┐\n';
    message += `│ 👆 Всего кликов: ${buttonStats.totalClicks.toString().padEnd(8)} │\n`;
    message += `│ 🎯 Уникальных кнопок: ${buttonStats.uniqueButtons.toString().padEnd(4)} │\n`;
    message += '├──────────────────────────────┤\n';

    buttonStats.allButtons.sort((a, b) => a.buttonId.localeCompare(b.buttonId)).forEach(button => {
        message += `│ 🔘 ${button.buttonId.padEnd(15)} ${button.count.toString().padEnd(5)} │\n`;
    });
    message += '└──────────────────────────────┘\n\n';

    message += '🎭 ДЕТАЛЬНАЯ СТАТИСТИКА МЕРОПРИЯТИЙ\n';
    eventsStats.forEach(event => {
        message += `\n🎪 ${event.title}\n`;
        message += '┌──────────────────────────────┐\n';
        message += `│ 🎫 Всего билетов: ${event.total.toString().padEnd(8)} │\n`;
        message += `│ ✅ Использовано:  ${event.used.toString().padEnd(8)} │\n`;
        message += `│ 🔥 Активные:      ${event.active.toString().padEnd(8)} │\n`;
        message += `│ 💰 Оплачено:      ${event.paid.toString().padEnd(8)} │\n`;
        message += '└──────────────────────────────┘\n';
    });

    message += `\n👥 ПОЛНЫЙ СПИСОК ПОКУПАТЕЛЕЙ (${customersData.length})\n`;
    customersData.forEach((customer, index) => {
        message += `\n${index + 1}. 👤 ${customer.first_name} ${customer.last_name}\n`;
        message += `   📞 ${customer.phone || 'Не указан'}\n`;
        message += `   📧 ${customer.email || 'Не указан'}\n`;
        message += `   🎟 Билетов: ${customer.tickets_count} шт | 🛒 Заказов: ${customer.orders_count}\n`;
        message += `   🆔 ID пользователя: ${customer.user_id}\n`;
    });

    return message;
};

export const adminPanelController = {
    handleAdminPanel: async (chatId) => {
        try {
            if (!userStates[chatId]) userStates[chatId] = {};
            userStates[chatId].isAdminAction = true;

            await bot.sendChatAction(chatId, 'typing');

            const [eventsStats, customersData, generalStats, buttonStats] = await Promise.all([
                adminPanelController.getEventsStatistics(),
                adminPanelController.getCustomersStatistics(),
                adminPanelController.getGeneralStatistics(),
                adminPanelController.getButtonStatistics()
            ]);

            const message = formatAdminMessage(eventsStats, customersData, generalStats, buttonStats);

            await bot.sendMessage(chatId, message, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🔄 Обновить', callback_data: 'admin_panel' },
                            { text: '📊 Подробнее', callback_data: 'admin_full_stats' }
                        ],
                        [
                            { text: '🏠 В меню', callback_data: 'back_to_command_menu' }
                        ]
                    ]
                }
            });

        } catch (error) {
            console.error('Admin panel error:', error);
            await bot.sendMessage(
                chatId,
                '⚠ Ошибка при загрузке данных. Попробуйте позже или обратитесь к разработчику'
            );
        }
    },

    getButtonStatistics: async () => {
        try {
            const buttonTrackingService = new ButtonTrackingService();
            const allButtons = await buttonTrackingService.getAllButtons();

            return {
                totalClicks: allButtons.reduce((sum, button) => sum + button.count, 0),
                uniqueButtons: allButtons.length,
                allButtons: allButtons
            };
        } catch (error) {
            console.error('Error getting button statistics:', error);
            return {
                totalClicks: 0,
                uniqueButtons: 0,
                allButtons: []
            };
        }
    },

    getEventsStatistics: async () => {
        try {
            const events = await Ticket.findAll({
                include: [{
                    model: UserTicket,
                    as: 'user_tickets'
                }]
            });

            return events.map(event => {
                const userTickets = event.user_tickets || [];

                return {
                    id: event.id,
                    title: event.title,
                    total: userTickets.length,
                    used: userTickets.filter(t => t.is_used).length,
                    active: userTickets.filter(t => !t.is_used && t.payment_status === 'paid').length,
                    paid: userTickets.filter(t => t.payment_status === 'paid').length
                };
            });
        } catch (error) {
            console.error('Error getting events statistics:', error);
            return [];
        }
    },

    getCustomersStatistics: async () => {
        try {
            const usersWithTickets = await UserTicket.findAll({
                where: { payment_status: 'paid' },
                attributes: ['user_id'],
                group: ['user_id'],
                raw: true
            });

            const customers = await Promise.all(
                usersWithTickets.map(async ({ user_id }) => {
                    const lastOrder = await Order.findOne({
                        where: { user_id, status: 'paid' },
                        order: [['created_at', 'DESC']],
                        attributes: ['first_name', 'last_name', 'email', 'phone'],
                        raw: true
                    });

                    const tickets_count = await UserTicket.count({
                        where: { user_id, payment_status: 'paid' }
                    });

                    const orders_count = await Order.count({
                        where: { user_id, status: 'paid' }
                    });

                    return {
                        user_id,
                        first_name: lastOrder?.first_name || 'Неизвестно',
                        last_name: lastOrder?.last_name || 'Неизвестно',
                        email: lastOrder?.email || 'Не указан',
                        phone: lastOrder?.phone || 'Не указан',
                        tickets_count,
                        orders_count
                    };
                })
            );

            return customers.sort((a, b) => b.tickets_count - a.tickets_count);
        } catch (error) {
            console.error('Error getting customers statistics:', error);
            return [];
        }
    },

    getGeneralStatistics: async () => {
        try {
            const allTickets = await UserTicket.findAll();
            const paidTickets = allTickets.filter(t => t.payment_status === 'paid');

            return {
                total: paidTickets.length,
                used: paidTickets.filter(t => t.is_used).length,
                active: paidTickets.filter(t => !t.is_used).length,
                pending: allTickets.filter(t => t.payment_status === 'pending').length
            };
        } catch (error) {
            console.error('Error calculating general stats:', error);
            return { total: 0, used: 0, active: 0, pending: 0 };
        }
    },

    getFullStatistics: async (chatId) => {
        try {
            await bot.sendChatAction(chatId, 'typing');

            const [eventsStats, customersData, generalStats, buttonStats] = await Promise.all([
                adminPanelController.getEventsStatistics(),
                adminPanelController.getCustomersStatistics(),
                adminPanelController.getGeneralStatistics(),
                adminPanelController.getButtonStatistics()
            ]);

            const message = formatFullStatsMessage(eventsStats, customersData, generalStats, buttonStats);

            await bot.sendMessage(chatId, message, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🔄 Обновить', callback_data: 'admin_full_stats' },
                            { text: '📋 Кратко', callback_data: 'admin_panel' }
                        ],
                        [
                            { text: '🏠 В меню', callback_data: 'back_to_command_menu' }
                        ]
                    ]
                }
            });

        } catch (error) {
            console.error('Full statistics error:', error);
            await bot.sendMessage(
                chatId,
                '⚠ Ошибка при загрузке полной статистики. Попробуйте позже'
            );
        }
    }
};