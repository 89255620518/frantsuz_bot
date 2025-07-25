import { bot } from '../botInstance.js';

export const refundRules = {

  generateRefundRules: () => {
    return `
🎭 <b>Правила возврата в Развлекательном клубе "Француз"</b> 🎤🎱💿

<u>Для вашего комфорта мы разработали прозрачную систему возвратов:</u>

📜 <b>Законодательная база:</b>
• Федеральный закон "О защите прав потребителей" (ст. 26.1 и 32)
• Постановление Правительства № 1153 (от 16.11.2021)

✨ <b>Возврат билетов на мероприятия:</b>
✅ <i>Когда возможно:</i>
▸ При отмене/переносе мероприятия - 100% возврат
▸ По вашей инициативе за 7-14 дней - 90% стоимости
▸ За 3-7 дней - 50% стоимости

❌ <i>Когда невозможно:</i>
▸ Если вы не пришли на мероприятие
▸ Билеты по акции "Non-refundable"
▸ Менее 24 часов до начала

🍹 <b>Возврат брони столиков:</b>
• При бронировании - оплата не возвращается

🎯 <b>Бильярд и игровые зоны:</b>
• Предоплата не возвращается
• При опоздании более 30 минут - бронь аннулируется

📌 <b>Как оформить возврат?</b>
1. Напишите нам в этот чат
2. Укажите дату и номер заказа
3. Приложите чек (если есть)
4. Деньги вернутся в течение 10 дней

<i>Мы всегда идем навстречу нашим гостям!</i> По особым случаям возможны индивидуальные решения 😊`
  },

  sendRefundRules: async (chatId, bot) => {
    try {
      await bot.sendMessage(chatId, refundRules.generateRefundRules(), {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 В меню', callback_data: 'back_to_main' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error sending refund rules:', error);
      await bot.sendMessage(chatId, '⚠️ Произошла ошибка при загрузке правил. Пожалуйста, попробуйте позже.');
    }
  }
};