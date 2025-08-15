import { bot } from '../../botInstance.js';
import { UserTicket } from '../../../models/UserTicket.js';
import { Ticket } from '../../../models/Event.js';
import { ensureUserRegistered } from '../mainMenu.js';

// Цветовая палитра для разных типов билетов
const TICKET_THEMES = {
    DEFAULT: {
        bgColor: '#6a11cb',
        textColor: '#ffffff',
        accentColor: '#f6d365'
    },
    VIP: {
        bgColor: '#ff4e50',
        textColor: '#ffffff',
        accentColor: '#f9d423'
    },
    EVENT: {
        bgColor: '#3a7bd5',
        textColor: '#ffffff',
        accentColor: '#00d2ff'
    },
    DISCOUNT: {
        bgColor: '#11998e',
        textColor: '#ffffff',
        accentColor: '#38ef7d'
    }
};

export async function handleMyTickets(callbackQuery) {
    try {
        if (!callbackQuery?.message?.chat?.id || !callbackQuery.from) {
            throw new Error('Неверная структура callbackQuery');
        }

        const chatId = callbackQuery.message.chat.id;
        const user = await ensureUserRegistered({
            from: callbackQuery.from,
            message: callbackQuery.message
        });

        if (!user?.telegram_id) {
            throw new Error('Не удалось получить данные пользователя');
        }

        const userTickets = await UserTicket.findAll({
            where: { 
                user_id: user.telegram_id,
                payment_status: 'paid'
            },
            include: [{
                model: Ticket,
                as: 'ticket',
                required: true
            }],
            order: [['ticket', 'event_date', 'ASC']]
        });

        if (!userTickets || userTickets.length === 0) {
            return await sendStyledMessage(chatId, {
                text: '🎭 У вас пока нет активных билетов',
                theme: TICKET_THEMES.DEFAULT
            });
        }

        for (const userTicket of userTickets) {
            if (!userTicket) continue;
            await sendTicketDesign(chatId, userTicket);
        }

        await bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
        console.error('Ошибка при обработке билетов:', error);
        if (callbackQuery?.id) {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '⚠️ Произошла ошибка при загрузке билетов',
                show_alert: true
            });
        }
    }
}

export async function handleMyTicketsCommand(msg) {
    try {
        if (!msg?.chat?.id) {
            throw new Error('Неверная структура сообщения');
        }

        const chatId = msg.chat.id;
        const user = await ensureUserRegistered(msg);

        if (!user?.telegram_id) {
            throw new Error('Не удалось получить данные пользователя');
        }

        const userTickets = await UserTicket.findAll({
            where: { 
                user_id: user.telegram_id,
                payment_status: 'paid'
            },
            include: [{
                model: Ticket,
                as: 'ticket',
                required: true
            }],
            order: [['ticket', 'event_date', 'ASC']]
        });

        if (!userTickets || userTickets.length === 0) {
            return await sendStyledMessage(chatId, {
                text: '🎭 У вас пока нет активных билетов',
                theme: TICKET_THEMES.DEFAULT
            });
        }

        for (const userTicket of userTickets) {
            if (!userTicket) continue;
            await sendTicketDesign(chatId, userTicket);
        }

    } catch (error) {
        console.error('Ошибка при обработке билетов:', error);
        if (msg?.chat?.id) {
            await bot.sendMessage(msg.chat.id, '⚠️ Произошла ошибка при загрузке билетов');
        }
    }
}

async function sendTicketDesign(chatId, userTicket) {
    try {
        if (!userTicket?.ticket || !userTicket?.qr_code) {
            console.error('Неверные данные билета:', userTicket);
            return;
        }

        const ticket = userTicket.ticket;
        const qrCodeBase64 = userTicket.qr_code;
        
        const ticketText = `
🎫 ${ticket.title || 'Без названия'} 🎫

▫️ Номер билета: ${userTicket.ticket_number || 'не указан'}
▫️ Дата: ${formatDate(ticket.event_date)}
▫️ Место: ${ticket.event_location || 'не указано'}
▫️ Стоимость: ${ticket.price || 0} руб.

🔸 QR-код для входа (сохраните его):
`;

        const buttons = [
            [
                { 
                    text: '🔄 Оформить возврат', 
                    callback_data: `refund_ticket_${userTicket.id}`
                },
                { 
                    text: '📝 Правила возврата', 
                    callback_data: 'refund'
                }
            ]
        ];

        const qrCodeBuffer = Buffer.from(qrCodeBase64.split(',')[1], 'base64');
        await bot.sendPhoto(chatId, qrCodeBuffer, {
            caption: ticketText,
            reply_markup: { inline_keyboard: buttons }
        });

    } catch (error) {
        console.error('Ошибка при отправке билета:', error);
        if (chatId) {
            await bot.sendMessage(chatId, '⚠️ Не удалось отправить билет. Пожалуйста, попробуйте позже.');
        }
    }
}

function determineTicketTheme(ticket) {
    if (!ticket) return TICKET_THEMES.DEFAULT;
    
    if (ticket.price > 5000) return TICKET_THEMES.VIP;
    if (ticket.title?.includes('концерт') || ticket.title?.includes('шоу')) return TICKET_THEMES.EVENT;
    if (ticket.price < 2000) return TICKET_THEMES.DISCOUNT;
    return TICKET_THEMES.DEFAULT;
}

function formatDate(date) {
    if (!date) return 'дата не указана';
    
    try {
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        
        return `${day}.${month}.${year} в ${hours}:${minutes}`;
    } catch (e) {
        console.error('Неверный формат даты:', date);
        return 'дата не указана';
    }
}

async function sendStyledMessage(chatId, { text, theme = TICKET_THEMES.DEFAULT }) {
    try {
        await bot.sendMessage(chatId, text, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎭 Посмотреть мероприятия', callback_data: 'show_tickets' }]
                ]
            }
        });
    } catch (error) {
        console.error('Ошибка при отправке стилизованного сообщения:', error);
    }
}

export function setupMyTicketsHandler() {
    bot.on('callback_query', async (callbackQuery) => {
        if (callbackQuery.data === 'my_tickets') {
            await handleMyTickets(callbackQuery);
        }
    });
}