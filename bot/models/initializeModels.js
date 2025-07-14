import { User, initUser } from './User.js';
import pkg from '../config/config.cjs';
const { sequelize } = pkg;

async function initializeModels() {
    try {
        // Инициализация модели User
        const userModel = initUser(sequelize);
        
        // Синхронизация с базой данных
        await sequelize.sync({ alter: true });
        console.log('Все модели успешно синхронизированы с БД');
        
        return {
            User: userModel
        };
    } catch (error) {
        console.error('Ошибка при инициализации моделей:', error);
        throw error;
    }
}

export { initializeModels };