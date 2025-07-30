import { bot } from '../botInstance.js';

export const showContacts = async (chatId) => {
    const contactsText = `📞 Контакты развлекательного комплекса "Француз":

📍 Адрес: г. Москва, ул. Салтыковская, 49А
☎ Телефон: +7(968) 090-55-50
📱 Банкетный менеджер: +7(968) 091-55-50
✉ Email: order@wetop.ru

🕒 Часы работы: 
Пн-Чт: с 12:00 до 00:00
Пт-Сб: с 12:00 до 02:00
Вс: с 12:00 до 00:00`;

    await bot.sendMessage(chatId, contactsText, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Открыть карту', url: 'https://yandex.ru/maps/-/CDqZIVX8' }]
            ]
        }
    });
};