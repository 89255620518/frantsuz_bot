import dotenv from 'dotenv';
import { initializeModels } from './models/initializeModels.js';
import { setupEventHandlers } from './telegram/handlers/handlers.js';

dotenv.config();

async function startBot() {
  try {
    await initializeModels();

    setupEventHandlers();
    console.log('Bot started successfully');
  } catch (error) {
    console.error('Bot startup failed:', error);
    process.exit(1);
  }
}

startBot();