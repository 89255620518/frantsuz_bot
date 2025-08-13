import { initUser } from './User.js';
import { initTicket } from './Event.js';
import { initUserTicket } from './UserTicket.js';
import { initOrder } from './Orders.js';
import { initOrderItem } from './OrderItem.js';
import { initButtonClick } from './ButtonClick.js';
import { initRefund, initRefundTicket } from './Refund.js';
import pkg from '../config/config.cjs';
const { sequelize } = pkg;

async function initializeModels() {
    try {
        // Инициализация моделей
        const User = initUser(sequelize);
        const Ticket = initTicket(sequelize);
        const UserTicket = initUserTicket(sequelize);
        const Order = initOrder(sequelize);
        const OrderItem = initOrderItem(sequelize);
        const ButtonClick = initButtonClick(sequelize);
        const Refund = initRefund(sequelize);
        const RefundTicket = initRefundTicket(sequelize);

        // Установка связей между моделями
        User.associate({ Ticket, UserTicket, Order });
        Ticket.associate({ User, UserTicket, OrderItem });
        UserTicket.associate({ User, Ticket, OrderItem, RefundTicket });
        Order.associate({ User, OrderItem, UserTicket });
        OrderItem.associate({ Order, UserTicket });
        Refund.associate({ RefundTicket, User, UserTicket });
        RefundTicket.associate({ Refund, UserTicket })

        // Синхронизация с базой данных
        await sequelize.sync({ alter: true });
        console.log('Все модели успешно синхронизированы с БД');

        return {
            User,
            Ticket,
            UserTicket,
            Order,
            OrderItem,
            ButtonClick,
            Refund,
            RefundTicket,
        };
    } catch (error) {
        console.error('Ошибка при инициализации моделей:', error);
        throw error;
    }
}

export { initializeModels };