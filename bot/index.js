import dotenv from 'dotenv';
import { initializeModels } from './models/initializeModels.js';
import { setupEventHandlers } from './telegram/handlers.js';
import { bot } from './telegram/botInstance.js';

dotenv.config();

async function startBot() {
  try {
    // Инициализация моделей
    await initializeModels();
    
    // Настройка обработчиков
    setupEventHandlers();
    console.log('Bot started successfully');
  } catch (error) {
    console.error('Bot startup failed:', error);
    process.exit(1);
  }
}

startBot();