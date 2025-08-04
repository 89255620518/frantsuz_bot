import { UserTicket } from '../../../models/UserTicket.js';
import { Ticket } from '../../../models/Event.js';
import { Order } from '../../../models/Orders.js';
import { bot } from '../../botInstance.js';
import { userStates } from '../../../state.js';
import { ButtonTrackingService } from '../../../services/ButtonTrackingService.js';

// Улучшенные функции форматирования с HTML
const formatAdminMessage = (eventsStats, customersData, generalStats, buttonStats) => {
    let message = `
<b>✨ ПАНЕЛЬ АДМИНИСТРАТОРА ✨</b>

<b>📊 ОБЩАЯ СТАТИСТИКА БИЛЕТОВ</b>
<pre>┌──────────────────────────────┐
│                              │
│  🎫  Всего продано:  <b>${generalStats.total.toString().padEnd(6)}</b> │
│  ✅  Использовано:   <b>${generalStats.used.toString().padEnd(6)}</b> │
│  🔥  Активные:       <b>${generalStats.active.toString().padEnd(6)}</b> │
│  💰  Оплаченные:     <b>${generalStats.paid || generalStats.total - generalStats.pending}</b>     │
│                              │
└──────────────────────────────┘</pre>

<b>🖱 СТАТИСТИКА ВЗАИМОДЕЙСТВИЙ</b>
<pre>┌──────────────────────────────┐
│  👆  Всего кликов:    <b>${String(buttonStats.totalClicks).padStart(6)}</b>  │
│  🎯  Уник. кнопок:    <b>${String(buttonStats.uniqueButtons).padStart(6)}</b>  │
├──────────────────────────────┤
│        <b>ТОП-5 КНОПОК</b>        │
├────────────────┬─────────────┤
${[...buttonStats.allButtons]
  .sort((a, b) => b.count - a.count)
  .slice(0, 5)
  .map(button => `│  🔘 <b>${button.buttonId.padEnd(12)}</b> │ <b>${String(button.count).padStart(9)}</b> │`)
  .join('\n')}
└────────────────┴─────────────┘</pre>`;

    // Блок мероприятий
    message += `<b> 🎭 АКТИВНЫЕ МЕРОПРИЯТИЯ</b>`;
    eventsStats.forEach(event => {
        const eventDate = new Date(event.date);
        const formattedDate = [
            String(eventDate.getDate()).padStart(2, '0'),
            String(eventDate.getMonth() + 1).padStart(2, '0'),
            eventDate.getFullYear()
        ].join('.');

        message += `
        
<b>🎪 ${event.title} ─ ${formattedDate}</b>
<pre>┌────────────────────┬───────────────┐
│ 🎫 Всего билетов  │ <b>${event.total.toString().padEnd(13)}</b> │
│ ✅ Использовано   │ <b>${event.used.toString().padEnd(13)}</b> │
│ 🔥 Активные       │ <b>${event.active.toString().padEnd(13)}</b> │
│ 💰 Оплачено       │ <b>${event.paid.toString().padEnd(13)}</b> │
└────────────────────┴───────────────┘</pre>`;
    });

    // Блок покупателей
    message += `\n<b>👥 ТОП-5 ПОКУПАТЕЛЕЙ (всего: ${customersData.length})</b>`;
    customersData.slice(0, 5).forEach((customer, index) => {
        message += `
        
${index + 1}. <b>${customer.first_name} ${customer.last_name}</b>
   📞 <i>${customer.phone || 'Не указан'}</i> | 📧 <i>${customer.email || 'Не указан'}</i>
   🎟 Билетов: <b>${customer.tickets_count}</b> | 🛒 Заказов: <b>${customer.orders_count}</b>
   <i>───────────────────────────</i>`;
    });

    if (customersData.length > 5) {
        message += `\n\n...и ещё <b>${customersData.length - 5}</b> покупателей`;
    }

    return message;
};

const formatFullStatsMessage = (eventsStats, customersData, generalStats, buttonStats) => {
    let message = `<b>📈 ПОЛНАЯ СТАТИСТИКА СИСТЕМЫ 📉</b>

<b>📊 ДЕТАЛИЗИРОВАННАЯ СТАТИСТИКА</b>
<pre>┌────────────────────────────────────┐
│                                    │
│  🎫  Всего билетов продано: <b>${generalStats.total.toString().padEnd(6)}</b>  │
│  ✅  Использовано билетов:  <b>${generalStats.used.toString().padEnd(6)}</b>  │
│  🔥  Активных билетов:      <b>${generalStats.active.toString().padEnd(6)}</b>  │
│  💰  Оплаченных билетов:    <b>${generalStats.paid || generalStats.total - generalStats.pending}</b>  │
│  ⏳  Ожидающих оплаты:      <b>${generalStats.pending.toString().padEnd(6)}</b>  │
│                                    │
└────────────────────────────────────┘</pre>

<b>🖱 ПОЛНАЯ СТАТИСТИКА КНОПОК</b>
<pre>┌──────────────────┬─────────────┐
│ Всего кликов     │ <b>${buttonStats.totalClicks.toString().padEnd(11)}</b> │
│ Уникальных кнопок │ <b>${buttonStats.uniqueButtons.toString().padEnd(11)}</b> │
├──────────────────┴─────────────┤
│       <b>ВСЕ КНОПКИ ПО АЛФАВИТУ</b>    │
├──────────────────┬─────────────┤
${buttonStats.allButtons.sort((a, b) => a.buttonId.localeCompare(b.buttonId)).map(button => 
`│ <b>${button.buttonId.padEnd(16)}</b> │ <b>${button.count.toString().padEnd(11)}</b> │`).join('\n')}
└──────────────────┴─────────────┘</pre>
`;

    // Детальная статистика мероприятий
    message += `<b>🎭 ДЕТАЛЬНАЯ СТАТИСТИКА МЕРОПРИЯТИЙ</b>`;
    eventsStats.forEach(event => {
        const eventDate = new Date(event.date);
        const formattedDate = [
            String(eventDate.getDate()).padStart(2, '0'),
            String(eventDate.getMonth() + 1).padStart(2, '0'),
            eventDate.getFullYear()
        ].join('.');

        message += `
        
<b>🎪 ${event.title} ─ ${formattedDate}</b>
<pre>┌──────────────────────────────┐
│ 🎫 Всего билетов: <b>${event.total.toString().padEnd(12)}</b> │
│ ✅ Использовано:  <b>${event.used.toString().padEnd(12)}</b> │
│ 🔥 Активные:      <b>${event.active.toString().padEnd(12)}</b> │
│ 💰 Оплачено:      <b>${event.paid.toString().padEnd(12)}</b> │
└──────────────────────────────┘</pre>`;
    });

    // Полный список покупателей
    message += `\n<b>👥 ПОЛНЫЙ СПИСОК ПОКУПАТЕЛЕЙ (${customersData.length})</b>`;
    customersData.forEach((customer, index) => {
        message += `
        
${index + 1}. <b>${customer.first_name} ${customer.last_name}</b>
   📞 <i>${customer.phone || 'Не указан'}</i> | 📧 <i>${customer.email || 'Не указан'}</i>
   🎟 Билетов: <b>${customer.tickets_count}</b> | 🛒 Заказов: <b>${customer.orders_count}</b>
   🆔 ID: <code>${customer.user_id}</code>
   <i>───────────────────────────</i>`;
    });

    return message;
};

// Остальная часть кода остается без изменений
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
                parse_mode: 'HTML',
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
                    date: event.event_date,
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
                pending: allTickets.filter(t => t.payment_status === 'pending').length,
                paid: paidTickets.length
            };
        } catch (error) {
            console.error('Error calculating general stats:', error);
            return { total: 0, used: 0, active: 0, pending: 0, paid: 0 };
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
                parse_mode: 'HTML',
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