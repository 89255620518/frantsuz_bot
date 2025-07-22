import { bot } from '../botInstance.js';

export const payRules = {
  generatePayRules: () => {
    return `
🎭 <b>Правила оплаты в Развлекательном клубе "Француз"</b> 🎤🎱💿

💳 <b>Принимаем к оплате:</b>
Visa | MasterCard | Мир 

🔄 <b>Процесс оплаты:</b>
После ввода данных вы будете перенаправлены на защищённый платёжный шлюз:
• ПАО «Сбербанк России»
• ПАО «Банк ВТБ» 
• PayKeeper

🔐 <b>Безопасность:</b>
• SSL-шифрование всех данных
• Соответствие стандарту PCI DSS
• Технология 3D-Secure (Visa/MC/Mir)

📝 <b>Что потребуется:</b>
┌ Номер карты
├ Срок действия
├ Имя держателя (латиницей)
└ CVC2/CVV2 код

🛡 <b>Рекомендации:</b>
• Храните карты как наличные
• Не сообщайте данные посторонним
• Вводите реквизиты только на проверенных сайтах
• Имейте под рукой телефон банка

🏢 <b>Реквизиты:</b>
<b>ООО "ЭкоСтар"</b>
┌ ИНН: 5041214554
├ ОГРН: 1235000052330
├ Адрес: г. Москва, ул. Салтыковская, д. 49А
├ Телефон: +7(968) 091-55-50
└ Email: order@wetop.ru
🕚 Режим работы: 11:00 – 23:00
    `;
  },

  sendPayRules: async (chatId, bot) => {
    try {
      await bot.sendMessage(chatId, payRules.generatePayRules(), {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 В меню', callback_data: 'back_to_main' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error sending payment rules:', error);
      await bot.sendMessage(chatId, '⚠️ Произошла ошибка при загрузке правил оплаты. Пожалуйста, попробуйте позже.');
    }
  }
};