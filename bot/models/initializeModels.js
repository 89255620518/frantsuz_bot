import { initUser } from './User.js';
import { initTicket } from './Event.js';
import { initUserTicket } from './UserTicket.js';
import pkg from '../config/config.cjs';
const { sequelize } = pkg;

async function initializeModels() {
    try {
        // Инициализация моделей
        const User = initUser(sequelize);
        const Ticket = initTicket(sequelize);
        const UserTicket = initUserTicket(sequelize);

        // Установка связей между моделями
        User.associate({ Ticket, UserTicket });
        Ticket.associate({ User, UserTicket });
        UserTicket.associate({ User, Ticket });

        // Синхронизация с базой данных
        await sequelize.sync({ alter: true });
        console.log('Все модели успешно синхронизированы с БД');

        return {
            User,
            Ticket,
            UserTicket,
        };
    } catch (error) {
        console.error('Ошибка при инициализации моделей:', error);
        throw error;
    }
}

export { initializeModels };