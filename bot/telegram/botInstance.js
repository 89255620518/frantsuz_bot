import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: {
    interval: 300, // Интервал опроса в мс
    autoStart: true,
    params: {
      timeout: 60 // Таймаут запроса в секундах
    }
  }
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code, error.message);
    
    // При критической ошибке можно попробовать перезапустить polling
    if (error.code === 'EFATAL') {
        console.log('Restarting polling...');
        setTimeout(() => bot.startPolling(), 5000);
    }
});

export { bot };