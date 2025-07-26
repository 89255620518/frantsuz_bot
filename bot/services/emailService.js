import nodemailer from 'nodemailer';
import { formatDate, formatTime } from './dateFormatters.js';

// Настройки SMTP
const transporter = nodemailer.createTransport({
    host: 'server61.hosting.reg.ru',
    port: 465,
    secure: true, // SSL
    auth: {
        user: 'zakaz@dali-khinkali.ru',
        pass: '1234567Asd!'
    }
});

const ADMIN_EMAIL = 'zakaz@dali-khinkali.ru'

/**
 * Генерирует HTML для билетов
 */
const generateTicketHtml = (ticket, eventData) => {
    return `
    <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px; background: white; position: relative; overflow: hidden; transition: transform 0.3s ease;">
        <div style="position: absolute; top: 0; left: 0; width: 5px; height: 100%; background: linear-gradient(to bottom, #d4af37, #f5d062);"></div>
        <div style="margin-left: 15px;">
            <h3 style="margin-top: 0; color: #2c3e50; font-size: 18px;">Билет №${ticket.ticket_number}</h3>
            <div style="display: flex; justify-content: space-between;">
                <div style="flex: 1;">
                    <p style="margin: 5px 0;"><strong>Мероприятие:</strong> ${eventData.title}</p>
                    <p style="margin: 5px 0;"><strong>Дата:</strong> ${formatDate(eventData.event_date)} в ${formatTime(eventData.event_date)}</p>
                    <p style="margin: 5px 0;"><strong>Место:</strong> ${eventData.event_location}</p>
                    <p style="margin: 5px 0;"><strong>Стоимость:</strong> ${ticket.ticket.price} руб.</p>
                </div>
                <div style="flex: 0 0 150px; text-align: center;">
                    <img src="${ticket.qr_code}" 
                        alt="QR Code" 
                        style="width: 120px; height: 120px; border: 1px solid #eee; border-radius: 5px;">
                    <p style="margin-top: 5px; font-size: 12px; color: #777;">Предъявите QR-код на входе</p>
                </div>
            </div>
        </div>
    </div>
    `;
};

/**
 * Отправка билетов клиенту на почту (объединенное письмо)
 */
export const sendTicketsToCustomer = async (userEmail, order, userTickets) => {
    try {
        // Группируем билеты по мероприятиям
        const eventsMap = new Map();

        userTickets.forEach(ticket => {
            const eventId = ticket.ticket.id;
            if (!eventsMap.has(eventId)) {
                eventsMap.set(eventId, {
                    eventData: ticket.ticket,
                    tickets: []
                });
            }
            eventsMap.get(eventId).tickets.push(ticket);
        });

        // Генерируем HTML для каждого мероприятия
        let eventsHtml = '';

        eventsMap.forEach((eventInfo, eventId) => {
            const ticketsHtml = eventInfo.tickets.map(ticket =>
                generateTicketHtml(ticket, eventInfo.eventData)
            ).join('');

            eventsHtml += `
            <div style="margin-bottom: 40px;">
                <h2 style="margin-bottom: 20px; font-size: 22px; color: #2c3e50; position: relative;">
                    <span style="display: inline-block; padding-bottom: 5px; border-bottom: 3px solid #d4af37;">
                        ${eventInfo.eventData.title}
                    </span>
                </h2>
                ${ticketsHtml}
            </div>
            `;
        });

        const mailOptions = {
            from: '" Развлекательный клуб Француз" <zakaz@dali-khinkali.ru>',
            to: userEmail,
            subject: `Ваши билеты в Развлекательный клуб "Француз"`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Ваши билеты в клуб "Француз"</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 650px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e1e1e1;
        }
        .logo {
            color: #d4af37;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .order-summary {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 25px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .summary-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .summary-item.total {
            font-weight: bold;
            font-size: 18px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #eee;
        }
        .customer-info {
            margin-top: 30px;
            padding: 20px;
            background: #f5f5f5;
            border-radius: 10px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #777;
            font-size: 14px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        .status-badge {
            display: inline-block;
            padding: 5px 10px;
            background-color: #4CAF50;
            color: white;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
        }
        .ticket:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">Развлекательный клуб "Француз"</div>
        <h1 style="margin: 0; font-size: 22px;">Ваши билеты</h1>
        <p style="margin-top: 5px; color: #777;">Благодарим за покупку!</p>
    </div>
    
    <div class="order-summary">
        <h2 style="margin-top: 0; font-size: 20px;">Детали заказа</h2>
        
        <div class="summary-item">
            <span>Номер заказа:</span>
            <span>№${order.id}</span>
        </div>
        <div class="summary-item">
            <span>Статус оплаты:</span>
            <span class="status-badge">Оплачено</span>
        </div>
        <div class="summary-item">
            <span>Количество билетов:</span>
            <span>${userTickets.length} шт.</span>
        </div>
        <div class="summary-item total">
            <span>Общая сумма:</span>
            <span>${order.total_amount} руб.</span>
        </div>
    </div>
    
    ${eventsHtml}
    
    <div class="customer-info">
        <h3 style="margin-top: 0;">Данные покупателя</h3>
        <p><strong>Имя:</strong> ${order.first_name} ${order.last_name}</p>
        <p><strong>Телефон:</strong> ${order.phone}</p>
        <p><strong>Email:</strong> ${order.email}</p>
    </div>
    
    <div class="footer">
        <p>Если у вас есть вопросы, ответьте на это письмо.</p>
        <p>Ждем вас в Развлекательном клубе "Француз"!</p>
        <p style="margin-top: 20px;">© ${new Date().getFullYear()} Развлекательный клуб "Француз". Все права защищены.</p>
    </div>
</body>
</html>
            `,
            attachments: userTickets.map(t => ({
                filename: `Билет_${t.ticket_number}.png`,
                content: t.qr_code.split(',')[1],
                encoding: 'base64'
            }))
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email с билетами отправлен на ${userEmail}`);
        return true;
    } catch (error) {
        console.error('Ошибка отправки email клиенту:', error);
        return false;
    }
};

export const notifyAdminAboutOrder = async (order, userTickets) => {
    try {
        // Группируем билеты по мероприятиям
        const eventsMap = new Map();

        userTickets.forEach(ticket => {
            const eventId = ticket.ticket.id;
            if (!eventsMap.has(eventId)) {
                eventsMap.set(eventId, {
                    eventData: ticket.ticket,
                    tickets: []
                });
            }
            eventsMap.get(eventId).tickets.push(ticket);
        });

        // Генерируем HTML для таблицы билетов
        let ticketsTableHtml = '';

        eventsMap.forEach((eventInfo, eventId) => {
            ticketsTableHtml += `
            <tr>
                <td colspan="2" style="background-color: #f5f5f5; font-weight: bold; padding: 12px 15px;">
                    ${eventInfo.eventData.title} (${formatDate(eventInfo.eventData.event_date)})
                </td>
            </tr>
            ${eventInfo.tickets.map(ticket => `
                <tr>
                    <td style="padding: 12px 15px; border-bottom: 1px solid #ddd;">
                        <strong>Номер билета:</strong> ${ticket.ticket_number}<br>
                        <strong>Стоимость:</strong> ${ticket.ticket.price} руб.
                    </td>
                </tr>
                <tr>
                    <td style="padding: 12px 15px; border-bottom: 1px solid #ddd; text-align: center;">
                        <img src="${ticket.qr_code}" 
                            alt="QR Code" 
                            style="width: 120px; height: 120px; border: 1px solid #eee; border-radius: 5px;">
                    </td>
                </tr>
            `).join('')}
            `;
        });

        const mailOptions = {
            from: '"Клуб Француз" <zakaz@dali-khinkali.ru>',
            to: ADMIN_EMAIL,
            subject: `Новый заказ №${order.id} в клубе "Француз"`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Новый заказ билетов</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 100%;
            margin: 0;
            padding: 0;
            background-color: #f9f9f9;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }
        .notification {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            max-width: 700px;
            margin: 20px auto;
        }
        h1 {
            color: #2c3e50;
            margin-top: 0;
            font-size: 22px;
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
        }
        .highlight {
            color: #d4af37;
            font-weight: bold;
        }
        .section {
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .section:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        .status-badge {
            display: inline-block;
            padding: 3px 8px;
            background-color: #4CAF50;
            color: white;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f5f5f5;
            font-weight: 600;
        }
        .customer-info {
            margin-top: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
        }
        .total-row {
            font-weight: bold;
            background-color: #f5f5f5;
        }
        @media only screen and (max-width: 600px) {
            .notification {
                padding: 15px;
                border-radius: 0;
            }
            table {
                display: block;
                overflow-x: auto;
            }
            th, td {
                padding: 8px 10px;
                font-size: 14px;
            }
            .section {
                padding-bottom: 15px;
                margin-bottom: 15px;
            }
            h1 {
                font-size: 20px;
            }
            .total-amount {
                white-space: nowrap;
            }
        }
    </style>
</head>
<body>
    <div class="notification">
        <h1>Новый заказ <span class="highlight">№${order.id}</span></h1>
        
        <div class="section">
            <h3 style="margin-top: 0;">Детали заказа</h3>
            <table>
                <tbody>
                    ${ticketsTableHtml}
                    <tr class="total-row">
                        <td style="text-align: right;">Итого:</td>
                        <td class="total-amount">${order.total_amount} руб.</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <div class="customer-info">
                <h3 style="margin-top: 0;">Информация о покупателе</h3>
                <p><strong>Имя:</strong> ${order.first_name} ${order.last_name}</p>
                <p><strong>Телефон:</strong> ${order.phone}</p>
                <p><strong>Email:</strong> ${order.email}</p>
                <p><strong>Дата заказа:</strong> ${formatDate(order.created_at)} в ${formatTime(order.created_at)}</p>
                <p><strong>Статус оплаты:</strong> <span class="status-badge">Оплачено</span></p>
            </div>
        </div>
    </div>
</body>
</html>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Уведомление администратору отправлено на ${ADMIN_EMAIL}`);
        return true;
    } catch (error) {
        console.error('Ошибка отправки уведомления администратору:', error);
        return false;
    }
};

export default {
    sendTicketsToCustomer,
    notifyAdminAboutOrder
};