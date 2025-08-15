import { bot } from '../../botInstance.js';
import { ensureUserRegistered } from '../mainMenu.js';

const refundButton = {
    showRefundinfo: async (chatId) => {
        try {
            const refundText = `
<b>Чтобы оформить возврат:</b>
Перейдите в "Мои билеты", выберите билеты и нажмите на кнопку "Оформить возврат", затем следуйте инструкции.

<b>Правила возврата:</b>

📜 <b>Законодательная база:</b>
• Федеральный закон "О защите прав потребителей" (ст. 26.1 и 32)
• Постановление Правительства № 1153 (от 16.11.2021)

✨ <b>Возврат билетов на мероприятия:</b>
✅ <i>Когда возможно:</i>
▸ При отмене/переносе мероприятия - 100% возврат
▸ По вашей инициативе от 7 дней - 90% стоимости
▸ За 3-7 дней - 50% стоимости

❌ <i>Когда невозможно:</i>
▸ Если вы не пришли на мероприятие
▸ Менее 3 дней до начала
            `;

            await bot.sendMessage( chatId, refundText, {
                parse_mode: 'HTML',
                reply_markup:{
                    inline_keyboard:  [
                        [
                            { text: '🎟️ Мои билеты', callback_data: 'my_tickets' },
                            { text: '📝 Правила возврата', callback_data: 'refund' }
                        ],

                        [
                            { text: '🔙 Назад', callback_data: 'back_to_command_menu' }
                        ]
                    ]
                }
            });
        } catch (error) {
            console.error('Ошибка при отображении информации о возврате:', error);
            await bot.sendMessage(chatId, '⚠️ Произошла ошибка при отображении информации о возврате.');
            
        }
    },

    handleCreateRefund: async (msgOrCallback) => {
        try {
            const chatId = msgOrCallback.chat?.id || msgOrCallback.message?.chat.id;
            const user = await ensureUserRegistered(msgOrCallback);

            await refundButton.showRefundinfo(chatId);

            if ( msgOrCallback.id ) {
                await bot.answerCallbackQuery(msgOrCallback.id);
            } 
        } catch ( error ) {
            console.error('Ошибка обработки запроса возврата:', error);
            
            const errorMessage = '⚠️ Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.';
            if (msgOrCallback.id) {
                await bot.answerCallbackQuery(msgOrCallback.id, {
                    text: errorMessage,
                    show_alert: true
                });
            } else {
                await bot.sendMessage(msgOrCallback.chat.id, errorMessage);
            }
        }
    },

    setupHandlers: () => {
        // Обработка команды /create_refund
        bot.onText(/^\/create_refund$/, async (msg) => {
            await refundButton.handleCreateRefund(msg);
        });

        // Обработка инлайн-кнопки create_refund
        bot.on('callback_query', async (callbackQuery) => {
            if (callbackQuery.data === 'create_refund') {
                await refundButton.handleCreateRefund(callbackQuery);
            }
        });
    },

    init: () => {
        refundButton.setupHandlers();
        console.log('Refund controller initialized');
    }
}

export default refundButton;
