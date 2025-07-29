import { UserTicket } from '../../../models/UserTicket.js';
import { Ticket } from '../../../models/Event.js';
import { Order } from '../../../models/Orders.js';
import { OrderItem } from '../../../models/OrderItem.js';
import { bot } from '../../botInstance.js';
import { userStates } from '../../../state.js';

export const adminPanelController = {
    handleAdminPanel: async (chatId) => {
        try {
            if (!userStates[chatId]) userStates[chatId] = {};
            userStates[chatId].isAdminAction = true;

            await bot.sendChatAction(chatId, 'typing');

            const [eventsStats, customersData, generalStats] = await Promise.all([
                adminPanelController.getEventsStatistics(),
                adminPanelController.getCustomersStatistics(),
                adminPanelController.getGeneralStatistics()
            ]);

            let message = `📊 *Панель администратора*\n\n`;

            message += `📊 *Общая статистика*\n`;
            message += `┌──────────────────────────────┐\n`;
            message += `│ 🎫 Всего билетов: ${generalStats.total.toString().padEnd(6)} │\n`;
            message += `│ ✅ Использовано:  ${generalStats.used.toString().padEnd(6)} │\n`;
            message += `│ 🔄 Активные:     ${generalStats.active.toString().padEnd(6)} │\n`;
            message += `│ ⏳ Ожидают оплаты:${generalStats.pending.toString().padEnd(6)} │\n`;
            message += `└──────────────────────────────┘\n\n`;

            message += `🎭 *Статистика мероприятий*\n`;
            eventsStats.forEach(event => {
                message += `▫️ *${event.title}*\n`;
                message += `   🎫 Всего: ${event.total} | ✅ ${event.used} | 🔄 ${event.active}\n\n`;
            });

            message += `👥 *Покупатели (${customersData.length})*\n`;

            customersData.forEach(customer => {
                message += `▫️ ${customer.first_name} ${customer.last_name}\n`;
                message += `   📞 ${customer.phone} | 📧 ${customer.email}\n`;
                message += `   🎫 Билетов: ${customer.tickets_count} шт\n\n`;
            });

            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🔄 Обновить', callback_data: 'admin_panel' },
                            { text: '📈 Подробнее', callback_data: 'admin_full_stats' }
                        ],
                        [
                            { text: '🔙 В меню', callback_data: 'back_to_main' }
                        ]
                    ]
                }
            });

        } catch (error) {
            console.error('Admin panel error:', error);
            await bot.sendMessage(
                chatId,
                '⚠️ *Ошибка при загрузке данных*\nПопробуйте позже или обратитесь к разработчику',
                { parse_mode: 'Markdown' }
            );
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
            // 1. Получаем всех уникальных пользователей с оплаченными билетами
            const usersWithTickets = await UserTicket.findAll({
                where: { payment_status: 'paid' },
                attributes: ['user_id'],
                group: ['user_id'],
                raw: true
            });

            // 2. Для каждого пользователя собираем данные
            const customers = await Promise.all(
                usersWithTickets.map(async ({ user_id }) => {
                    // Получаем последний заказ пользователя для контактных данных
                    const lastOrder = await Order.findOne({
                        where: { user_id, status: 'paid' },
                        order: [['created_at', 'DESC']],
                        attributes: ['first_name', 'last_name', 'email', 'phone'],
                        raw: true
                    });

                    // Считаем количество билетов пользователя
                    const tickets_count = await UserTicket.count({
                        where: { user_id, payment_status: 'paid' }
                    });

                    // Считаем количество заказов пользователя
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

            // 3. Проверка согласованности
            const totalTicketsFromCustomers = customers.reduce((sum, c) => sum + c.tickets_count, 0);
            const paidTicketsCount = await UserTicket.count({
                where: { payment_status: 'paid' }
            });

            if (totalTicketsFromCustomers !== paidTicketsCount) {
                console.warn(`Внимание: сумма билетов по покупателям (${totalTicketsFromCustomers}) не равна общему количеству оплаченных билетов (${paidTicketsCount})`);
            }

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
                total: paidTickets.length, // Только оплаченные билеты
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

            const [eventsStats, customersData, generalStats] = await Promise.all([
                adminPanelController.getEventsStatistics(),
                adminPanelController.getCustomersStatistics(),
                adminPanelController.getGeneralStatistics()
            ]);

            let message = `📈 *Полная статистика*\n\n`;

            message += `📊 *Общая статистика*\n`;
            message += `┌──────────────────────────────┐\n`;
            message += `│ 🎫 Всего билетов: ${generalStats.total.toString().padEnd(6)} │\n`;
            message += `│ ✅ Использовано:  ${generalStats.used.toString().padEnd(6)} │\n`;
            message += `│ 🔄 Активные:     ${generalStats.active.toString().padEnd(6)} │\n`;
            message += `│ ⏳ Ожидают оплаты:${generalStats.pending.toString().padEnd(6)} │\n`;
            message += `└──────────────────────────────┘\n\n`;

            message += `🎭 *Статистика мероприятий*\n`;
            eventsStats.forEach(event => {
                message += `▫️ *${event.title}*\n`;
                message += `   🎫 Всего: ${event.total} | ✅ ${event.used} | 🔄 ${event.active}\n\n`;
            });

            message += `👥 *Все покупатели (${customersData.length})*\n`;
            customersData.forEach(customer => {
                message += `▫️ ${customer.first_name} ${customer.last_name} |\n`;
                message += `   📞 ${customer.phone} |\n`;
                message += `   📧 ${customer.email} |\n`;
                message += `   🎫 Билетов: ${customer.tickets_count} шт\n\n`;
            });

            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🔄 Обновить', callback_data: 'admin_full_stats' },
                            { text: '📋 Кратко', callback_data: 'admin_panel' }
                        ],
                        [
                            { text: '🔙 В меню', callback_data: 'back_to_main' }
                        ]
                    ]
                }
            });

        } catch (error) {
            console.error('Full statistics error:', error);
            await bot.sendMessage(
                chatId,
                '⚠️ *Ошибка при загрузке полной статистики*\nПопробуйте позже',
                { parse_mode: 'Markdown' }
            );
        }
    }
};