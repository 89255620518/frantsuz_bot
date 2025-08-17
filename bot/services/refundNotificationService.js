import nodemailer from 'nodemailer';
import { Order, UserTicket } from '../models/index.js';

const transporter = nodemailer.createTransport({
    host: 'smtp.beget.com',
    port: 465,
    secure: true,
    auth: {
        user: 'ibra001@ibrokhim.ru',
        pass: 'Restart%1996'
    }
});

const ADMIN_EMAIL = 'ibra001@ibrokhim.ru';

export class RefundNotificationService {
    constructor() {
        this.transporter = transporter;
    }

    async refundEventTickets(eventId, actionType) {
        try {
            // Находим все билеты для мероприятия
            const tickets = await UserTicket.findAll({
                where: {
                    ticket_id: eventId,
                    payment_status: 'paid'
                },
                include: [
                    {
                        association: 'ticket',
                        attributes: ['title', 'event_date', 'price']
                    },
                    {
                        association: 'order_item',
                        include: ['order']
                    }
                ]
            });

            if (!tickets.length) {
                return {
                    success: false,
                    message: 'Нет оплаченных билетов для этого мероприятия'
                };
            }

            const event = tickets[0].ticket;
            const eventDate = new Date(event.event_date);
            const formattedDate = eventDate.toLocaleString('ru-RU');

            // Отправляем уведомления каждому покупателю
            const results = await Promise.all(
                tickets.map(ticket => this.sendRefundNotification(ticket, event, actionType))
            );

            // Подсчитываем результаты
            const successCount = results.filter(r => r.success).length;
            const failedCount = results.length - successCount;
            const totalAmount = tickets.length * parseFloat(event.price);

            return {
                success: true,
                refundedTickets: successCount,
                failedTickets: failedCount,
                totalAmount: totalAmount.toFixed(2),
                eventTitle: event.title,
                actionType: actionType,
                errors: results.filter(r => !r.success).map(r => r.error)
            };

        } catch (error) {
            console.error('Error processing refund notifications:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async sendRefundNotification(userTicket, event, actionType) {
        try {
            const order = userTicket.order_item?.order;
            if (!order) {
                throw new Error('Не найдена информация о заказе');
            }

            // Формируем сообщение в зависимости от типа действия
            const eventDate = new Date(event.event_date);
            const formattedDate = eventDate.toLocaleString('ru-RU');
            
            let emailSubject, emailText, smsText;

            if (actionType === 'canceled') {
                emailSubject = `Отмена мероприятия "${event.title}"`;
                emailText = `
                    Уважаемый(ая) ${order.first_name} ${order.last_name},

                    К сожалению, мероприятие "${event.title}", запланированное на ${formattedDate}, отменено.

                    Просим наши извинения за предоставленные неудобства. Для оформления возврата денежных средств за билет(ы) пожалуйста:

                    1. Ответьте на это письмо или напишите на ${ADMIN_EMAIL}
                    2. Укажите реквизиты банковской карты, с которой была произведена оплата
                    3. Укажите номер(а) билетов: ${userTicket.ticket_number}

                    Мы обработаем ваш запрос в течение 3-5 рабочих дней.

                    С уважением,
                    Развлекательный комплекс "Француз"
                `;
                smsText = `Француз: Мероприятие "${event.title}" отменено. Для возврата средств напишите на ${ADMIN_EMAIL} с указанием номера билета ${userTicket.ticket_number} и реквизитов карты`;
            } else {
                emailSubject = `Перенос мероприятия "${event.title}"`;
                emailText = `
                    Уважаемый(ая) ${order.first_name} ${order.last_name},

                    Мероприятие "${event.title}", запланированное на ${formattedDate}, перенесено на другую дату.

                    Просим наши извинения за предоставленные неудобства. Вы можете:
                    
                    1. Сохранить билет(ы) для посещения в новую дату
                    2. Или оформить возврат денежных средств

                    Для оформления возврата пожалуйста:
                    1. Ответьте на это письмо или напишите на ${ADMIN_EMAIL}
                    2. Укажите реквизиты банковской карты, с которой была произведена оплата
                    3. Укажите номер(а) билетов: ${userTicket.ticket_number}

                    Мы обработаем ваш запрос в течение 3-5 рабочих дней.

                    С уважением,
                    Развлекательный комплекс "Француз"
                `;
                smsText = `Француз: Мероприятие "${event.title}" перенесено. Для возврата средств напишите на ${ADMIN_EMAIL} с указанием номера билета ${userTicket.ticket_number} и реквизитов карты`;
            }

            // Отправляем email
            await this.sendEmail(order.email, emailSubject, emailText);
            
            // Отправляем SMS (заглушка - в реальности нужно подключить SMS-шлюз)
            await this.sendSMS(order.phone, smsText);

            return { success: true };

        } catch (error) {
            console.error(`Error sending notification for ticket ${userTicket.ticket_number}:`, error);
            return {
                success: false,
                error: error.message,
                ticketNumber: userTicket.ticket_number
            };
        }
    }

    async sendEmail(to, subject, text) {
        try {
            const mailOptions = {
                from: 'ibra001@ibrokhim.ru',
                to,
                subject,
                text,
                replyTo: ADMIN_EMAIL
            };

            await this.transporter.sendMail(mailOptions);
            console.log(`Email sent to ${to}`);
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }

    async sendSMS(phone, text) {
        try {
            // В реальности здесь нужно подключить API SMS-шлюза
            console.log(`SMS to ${phone}: ${text}`);
            // Заглушка - в реальном приложении здесь будет вызов API SMS-сервиса
            return true;
        } catch (error) {
            console.error('Error sending SMS:', error);
            throw error;
        }
    }
}