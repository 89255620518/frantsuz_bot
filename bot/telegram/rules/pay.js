import { bot } from '../botInstance.js';

export const pay = {
  generatePay: () => {
    return `
🎭 <b>Как купить билет в Развлекательном клубе "Француз"</b> 🎫✨

🚀 <b>Проще простого!</b> Всего 7 шагов к незабываемому вечеру:

1️⃣ <b>СТАРТУЕМ</b>
Нажмите волшебную кнопку "START" в нашем боте

2️⃣ <b>В МИР БИЛЕТОВ</b>
Выберите раздел "🎟 Билеты" в меню

3️⃣ <b>ВЫБОР ШОУ</b>
Найдите своё идеальное мероприятие и кликните "Купить билет"

4️⃣ <b>В КОРЗИНУ!</b>
Пролистайте вниз и нажмите кнопку "🛒 Оформить"

5️⃣ <b>ЗАПОЛНЯЕМ</b>
Введите ваши данные - мы же хотим знать, кто к нам придёт!

6️⃣ <b>ФИНАЛЬНЫЙ АККОРД</b>
Перед вами появится форма с кнопкой "💳 Перейти к оплате"

7️⃣ <b>ВСЁ ГОТОВО!</b>
Система перенаправит вас на защищённый платёжный шлюз PayKeeper

🎉 <b>Готово!</b> Ваш билет уже ждёт вас! 

<i>Возникли вопросы?</i> Наши администраторы всегда на связи! 💬
    `;
  },

  sendPay: async (chatId, bot) => {
    try {
      await bot.sendMessage(chatId, pay.generatePay(), {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 В меню', callback_data: 'back_to_main' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error sending payment instructions:', error);
      await bot.sendMessage(chatId, '⚠️ Ой! Что-то пошло не так при загрузке инструкции. Давайте попробуем ещё раз?');
    }
  }
};