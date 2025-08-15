import { bot } from '../../botInstance.js';
import { UserTicket } from '../../../models/UserTicket.js';
import { Ticket } from '../../../models/Event.js';
import { ensureUserRegistered } from '../mainMenu.js';
import RefundClientService from '../../../services/RefundClientService.js';
import { userStates } from '../../../state.js';
import { formatDate } from '../../../services/dateFormatters.js';

const refundSteps = [
    'start',
    'last_name',
    'first_name',
    'middle_name',
    'phone',
    'email',
    'account_number',
    'bank_name',
    'bik',
    'correspondent_account',
    'inn',
    'kpp',
    'refund_reason',
    'confirm'
];

const REFUND_RULES = {
    CANCELLED: { percent: 100, message: '100% возврат (отмена/перенос мероприятия)' },
    MORE_7_DAYS: { percent: 90, message: '90% возврат (от 7 дней до мероприятия)' },
    BETWEEN_3_7_DAYS: { percent: 50, message: '50% возврат (3-7 дней до мероприятия)' },
    LESS_3_DAYS: { percent: 0, message: 'Возврат невозможен (менее 3 дней до мероприятия)' },
    AFTER_EVENT: { percent: 0, message: 'Возврат невозможен (мероприятие уже прошло)' }
};

const refundService = new RefundClientService();

export async function handleRefundTicket(callbackQuery) {
    try {
        const chatId = callbackQuery.message.chat.id;
        const ticketId = callbackQuery.data.split('_')[2];
        
        if (!ticketId) {
            throw new Error('Не удалось получить ID билета');
        }

        // Получаем полную информацию о билете
        const userTicket = await UserTicket.findByPk(ticketId, {
            include: [{
                model: Ticket,
                as: 'ticket',
                required: true
            }]
        });

        if (!userTicket) {
            throw new Error('Билет не найден');
        }

        // Проверяем возможность возврата
        const refundInfo = calculateRefundAmount(userTicket.ticket.event_date);
        
        if (refundInfo.percent === 0) {
            return await bot.sendMessage(chatId, 
                `❌ Возврат невозможен:\n${refundInfo.message}\n\n` +
                `Дата мероприятия: ${formatDate(userTicket.ticket.event_date)}\n` +
                `Осталось дней: ${refundInfo.daysLeft || '0'}`
            );
        }

        // Рассчитываем сумму возврата
        const refundAmount = (userTicket.ticket.price * refundInfo.percent / 100).toFixed(2);

        // Инициализируем состояние для пользователя
        userStates[chatId] = {
            refund: {
                step: 'start',
                userTicketId: ticketId,
                ticketNumber: userTicket.ticket_number,
                originalAmount: userTicket.ticket.price,
                refundAmount: parseFloat(refundAmount),
                refundPercent: refundInfo.percent,
                refundReason: '',
                eventDate: userTicket.ticket.event_date,
                data: {}
            }
        };

        // Отправляем инструкцию с условиями возврата
        await bot.sendMessage(chatId, 
            `✨ <b>Условия возврата для вашего билета:</b>\n` +
            `▸ ${refundInfo.message}\n` +
            `▸ Сумма возврата: ${refundAmount} руб. (из ${userTicket.ticket.price} руб.)\n` +
            `▸ Дата мероприятия: ${formatDate(userTicket.ticket.event_date)}\n\n` +
            `📝 Для оформления возврата заполните данные:\n\n` +
            `1. Фамилия\n` +
            `2. Имя\n` +
            `3. Отчество\n` +
            `4. Номер телефона (+7XXXXXXXXXX)\n` +
            `5. Email\n` +
            `6. Номер счета\n` +
            `7. Наименование банка\n` +
            `8. БИК банка\n` +
            `9. Корреспондентский счет\n` +
            `10. ИНН\n` +
            `11. КПП (если есть)\n\n` +
            `12. Причина возврата\n\n` +
            `Отправляйте данные по одному в указанном порядке.\n\n` +
            `Введите фамилию:`,
            { parse_mode: 'HTML' }
        );

        await bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
        console.error('Ошибка при обработке возврата билета:', error);
        if (callbackQuery?.id) {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '⚠️ Произошла ошибка при обработке возврата',
                show_alert: true
            });
        }
    }
}

// Функция расчета суммы возврата
function calculateRefundAmount(eventDate) {
    const now = new Date();
    const eventDateTime = new Date(eventDate);
    const timeDiff = eventDateTime - now;
    const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (timeDiff < 0) {
        return { ...REFUND_RULES.AFTER_EVENT, daysLeft: 0 };
    }

    if (daysLeft < 3) {
        return { ...REFUND_RULES.LESS_3_DAYS, daysLeft };
    }

    if (daysLeft >= 3 && daysLeft <= 7) {
        return { ...REFUND_RULES.BETWEEN_3_7_DAYS, daysLeft };
    }

    return { ...REFUND_RULES.MORE_7_DAYS, daysLeft };
}

export async function processRefundStep(msg) {
    try {
        const chatId = msg.chat.id;
        const text = msg.text;
        const userState = userStates[chatId]?.refund;

        if (!userState) return;

        const currentStep = userState.step;
        const stepIndex = refundSteps.indexOf(currentStep);

        if (stepIndex === -1) return;

        // Сохраняем введенные данные
        switch (currentStep) {
            case 'start':
                userState.data.last_name = text;
                userState.step = 'last_name';
                await bot.sendMessage(chatId, 'Введите имя:');
                break;
            case 'last_name':
                userState.data.first_name = text;
                userState.step = 'first_name';
                await bot.sendMessage(chatId, 'Введите отчество:');
                break;
            case 'first_name':
                userState.data.middle_name = text;
                userState.step = 'middle_name';
                await bot.sendMessage(chatId, 'Введите номер телефона (+7XXXXXXXXXX):');
                break;
            case 'middle_name':
                if (!/^(\+7|8)[0-9]{10}$/.test(text)) {
                    await bot.sendMessage(chatId, 'Неверный формат телефона. Пожалуйста, введите номер в формате +7XXXXXXXXXX:');
                    return;
                }
                userState.data.phone = text;
                userState.step = 'phone';
                await bot.sendMessage(chatId, 'Введите email:');
                break;
            case 'phone':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
                    await bot.sendMessage(chatId, 'Неверный формат email. Пожалуйста, введите корректный email:');
                    return;
                }
                userState.data.email = text;
                userState.step = 'email';
                await bot.sendMessage(chatId, 'Введите номер счета:');
                break;
            case 'email':
                userState.data.account_number = text;
                userState.step = 'account_number';
                await bot.sendMessage(chatId, 'Введите наименование банка:');
                break;
            case 'account_number':
                userState.data.bank_name = text;
                userState.step = 'bank_name';
                await bot.sendMessage(chatId, 'Введите БИК банка:');
                break;
            case 'bank_name':
                userState.data.bik = text;
                userState.step = 'bik';
                await bot.sendMessage(chatId, 'Введите корреспондентский счет:');
                break;
            case 'bik':
                userState.data.correspondent_account = text;
                userState.step = 'correspondent_account';
                await bot.sendMessage(chatId, 'Введите ИНН:');
                break;
            case 'correspondent_account':
                userState.data.inn = text;
                userState.step = 'inn';
                await bot.sendMessage(chatId, 'Введите КПП (если нет, отправьте "-"):');
                break;
            case 'inn':
                userState.data.kpp = text === '-' ? null : text;
                userState.step = 'refund_reason';
                await bot.sendMessage(chatId, 'Введите причину возврата: ');
                break
            case 'refund_reason':
                userState.data.refund_reason = text;
                userState.refundReason = text;
                userState.step = 'confirm';              
                // Формируем сводку данных
                const summary = `
                ✨ <b>Проверьте введенные данные:</b>

                🎫 <b>Информация о билете:</b>
                ▸ Номер билета: ${userState.ticketNumber}
                ▸ Дата мероприятия: ${formatDate(userState.eventDate)}
                ▸ Сумма возврата: ${userState.refundAmount} руб. (${userState.refundPercent}% от ${userState.originalAmount} руб.)
                ▸ Причина возврата: ${userState.refundReason}

                👤 <b>Личные данные:</b>
                ▸ ФИО: ${userState.data.last_name} ${userState.data.first_name} ${userState.data.middle_name}
                ▸ Телефон: ${userState.data.phone}
                ▸ Email: ${userState.data.email}

                🏦 <b>Банковские реквизиты:</b>
                ▸ Счет: ${userState.data.account_number}
                ▸ Банк: ${userState.data.bank_name}
                ▸ БИК: ${userState.data.bik}
                ▸ Корр. счет: ${userState.data.correspondent_account}
                ▸ ИНН: ${userState.data.inn}
                ▸ КПП: ${userState.data.kpp || 'не указан'}

                <i>После подтверждения заявка будет отправлена на обработку. Средства поступят в течение 30 рабочих дней.</i>
                `;

                // Отправляем сводку и кнопки подтверждения
                await bot.sendMessage(chatId, summary, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Подтвердить возврат', callback_data: `confirm_refund_${userState.userTicketId}` }],
                            [{ text: '❌ Отменить', callback_data: 'cancel_refund' }]
                        ]
                    }
                });
                break;
        }

    } catch (error) {
        console.error('Ошибка при обработке шага возврата:', error);
        await bot.sendMessage(msg.chat.id, '⚠️ Произошла ошибка. Пожалуйста, попробуйте еще раз.');
    }
}

export async function confirmRefundRequest(callbackQuery) {
    try {
        const chatId = callbackQuery.message.chat.id;
        const userState = userStates[chatId]?.refund;

        if (!userState) {
            throw new Error('Состояние возврата не найдено');
        }

        const user = await ensureUserRegistered({
            from: callbackQuery.from,
            message: callbackQuery.message
        });

        if (!user?.telegram_id) {
            throw new Error('Не удалось получить данные пользователя');
        }

        // Создаем объект с данными для возврата
        const refundData = {
            ...userState.data,
            full_name: `${userState.data.last_name} ${userState.data.first_name} ${userState.data.middle_name}`,
            refund_reason: userState.refundReason,
            refund_amount: userState.refundAmount,
            okpo: null,
            ogrn: null
        };

        console.log(refundData, 'refund')

        // Используем сервис для создания заявки
        const result = await refundService.createRefundRequest(
            user.telegram_id,
            [userState.userTicketId],
            refundData
        );

        if (result.success) {
            await bot.sendMessage(chatId, 
                `✅ <b>Заявка на возврат №${result.refundId} успешно создана!</b>\n\n` +
                `▸ Номер билета: ${userState.ticketNumber}\n` +
                `▸ Сумма возврата: ${userState.refundAmount} руб.\n` +
                `▸ Основание: ${userState.refundReason}\n\n` +
                `<i>На ваш email ${refundData.email} отправлено подтверждение. ` +
                `Статус заявки можно проверить в разделе "Мои билеты". ` +
                `Средства поступят в течение 30 рабочих дней.</i>`,
                { parse_mode: 'HTML' }
            );
        } else {
            throw new Error('Не удалось создать заявку на возврат');
        }

        // Очищаем состояние
        delete userStates[chatId].refund;

        await bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
        console.error('Ошибка при подтверждении возврата:', error);
        if (callbackQuery?.id) {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '⚠️ Произошла ошибка при создании заявки',
                show_alert: true
            });
        }
    }
}

export async function cancelRefundRequest(callbackQuery) {
    try {
        const chatId = callbackQuery.message.chat.id;
        
        if (userStates[chatId]?.refund) {
            delete userStates[chatId].refund;
        }

        await bot.sendMessage(chatId, '❌ Заявка на возврат отменена.');
        await bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
        console.error('Ошибка при отмене возврата:', error);
        if (callbackQuery?.id) {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '⚠️ Произошла ошибка при отмене',
                show_alert: true
            });
        }
    }
}

export async function getUserRefundsList(telegramId) {
    try {
        if (!refundService) {
            throw new Error('Refund service not initialized');
        }
        return await refundService.getUserRefunds(telegramId);
    } catch (error) {
        console.error('Ошибка при получении списка возвратов:', error);
        throw error;
    }
}

// Добавляем функцию для получения деталей возврата
export async function getRefundDetailsForUser(refundId, telegramId) {
    try {
        if (!refundService) {
            throw new Error('Refund service not initialized');
        }
        return await refundService.getRefundDetails(refundId, telegramId);
    } catch (error) {
        console.error('Ошибка при получении деталей возврата:', error);
        throw error;
    }
}

export function setupRefundHandlers() {
    // Обработчик для кнопки "Оформить возврат" в билете
    bot.on('callback_query', async (callbackQuery) => {
        if (callbackQuery.data.startsWith('refund_ticket_')) {
            await handleRefundTicket(callbackQuery);
        }
    });

    // Обработчик для подтверждения возврата
    bot.on('callback_query', async (callbackQuery) => {
        if (callbackQuery.data.startsWith('confirm_refund_')) {
            await confirmRefundRequest(callbackQuery);
        }
    });

    // Обработчик для отмены возврата
    bot.on('callback_query', async (callbackQuery) => {
        if (callbackQuery.data === 'cancel_refund') {
            await cancelRefundRequest(callbackQuery);
        }
    });

    // Обработчик текстовых сообщений для шагов возврата
    bot.on('message', async (msg) => {
        if (msg.text && userStates[msg.chat.id]?.refund) {
            await processRefundStep(msg);
        }
    });
}