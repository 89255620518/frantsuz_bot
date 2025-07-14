import { initUser } from './User.js';
import { initTicket } from './Ticket.js';
import pkg from '../config/config.cjs';
const { sequelize } = pkg;

async function initializeModels() {
    try {
        // Инициализация моделей
        const userModel = initUser(sequelize);
        const ticketModel = initTicket(sequelize);
        
        // Установка связей между моделями
        ticketModel.associate({ User: userModel });
        
        // Синхронизация с базой данных
        await sequelize.sync({ alter: true });
        console.log('Все модели успешно синхронизированы с БД');
        
        return {
            User: userModel,
            Ticket: ticketModel
        };
    } catch (error) {
        console.error('Ошибка при инициализации моделей:', error);
        throw error;
    }
}

export { initializeModels };