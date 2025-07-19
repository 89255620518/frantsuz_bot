import dotenv from 'dotenv';
import { initializeModels } from './models/initializeModels.js';
import { setupEventHandlers } from './telegram/handlers/handlers.js';
import TicketService from './services/ticketService.js';

dotenv.config();

// Функция для периодической проверки просроченных билетов
async function startTicketCleanupJob() {
    try {
        // Интервал очистки (5 минут)
        const CLEANUP_INTERVAL = 5 * 60 * 1000;
        
        // Сначала выполняем очистку при старте
        await TicketService.performAutoCleanup();
        
        // Затем настраиваем периодическую очистку
        setInterval(async () => {
            try {
                await TicketService.performAutoCleanup();
            } catch (error) {
                console.error('Ошибка в задании очистки:', error);
            }
        }, CLEANUP_INTERVAL);
        
        console.log('Автоматическая очистка canceled билетов запущена');
    } catch (error) {
        console.error('Ошибка при запуске задачи очистки:', error);
    }
}

async function startBot() {
    try {
        await initializeModels();
        await startTicketCleanupJob(); // Запускаем фоновую задачу
        
        setupEventHandlers();
        console.log('Бот успешно запущен');
    } catch (error) {
        console.error('Ошибка запуска бота:', error);
        process.exit(1);
    }
}

startBot();