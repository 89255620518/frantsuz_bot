import { Refund, RefundTicket } from '../models/Refund.js';
import { UserTicket } from '../models/UserTicket.js';
import { Ticket } from '../models/Event.js';
import { User } from '../models/User.js';
import nodemailer from 'nodemailer';
import { formatDate, formatTime } from './dateFormatters.js';

class RefundClientService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: 'smtp.beget.com',
            port: 465,
            secure: true,
            auth: {
                user: 'ibra001@ibrokhim.ru',
                pass: 'Restart%1996'
            }
        });

        this.ADMIN_EMAIL = 'ibra001@ibrokhim.ru';
    }

    async createRefundRequest(userId, ticketIds, refundData) {
        const { 
            email, 
            phone, 
            full_name, 
            account_number, 
            bank_name, 
            bik, 
            correspondent_account, 
            inn, 
            kpp, 
            okpo, 
            ogrn, 
            refund_reason,
            refund_amount
        } = refundData;

        const transaction = await Refund.sequelize.transaction();

        try {
            // Проверяем, есть ли уже заявка на эти билеты
            const existingRefunds = await RefundTicket.findAll({
                where: { user_ticket_id: ticketIds },
                transaction
            });

            if (existingRefunds.length > 0) {
                throw new Error('На некоторые билеты уже подана заявка на возврат');
            }

            const tickets = await UserTicket.findAll({
                where: { id: ticketIds },
                transaction,
                include: [{
                    model: Ticket,
                    as: 'ticket',
                    attributes: ['title', 'price', 'event_date', 'event_location']
                }]
            });

            if (tickets.length === 0) throw new Error('Билеты не найдены');
            if (tickets.some(ticket => ticket.user_id !== userId)) {
                throw new Error('Некоторые билеты не принадлежат пользователю');
            }

            // Создаем заявку на возврат
            const refund = await Refund.create({
                user_id: userId,
                email,
                phone,
                full_name,
                account_number,
                bank_name,
                bik,
                correspondent_account,
                inn,
                kpp,
                okpo,
                ogrn,
                refund_amount,
                refund_reason
            }, { transaction });

            // Создаем связи между заявкой и билетами
            await Promise.all(tickets.map(ticket => 
                RefundTicket.create({
                    refund_id: refund.id,
                    user_ticket_id: ticket.id,
                    ticket_number: ticket.ticket_number,
                    refund_amount: ticket.ticket.price
                }, { transaction })
            ));

            // Обновляем статус билетов на "canceled"
            await UserTicket.update(
                { payment_status: 'canceled' },
                { 
                    where: { id: ticketIds },
                    transaction
                }
            );

            // Отправляем уведомления
            await Promise.all([
                this.sendRefundEmailToAdmin(refund, tickets),
                this.sendClientConfirmation(refund, tickets)
            ]);

            await transaction.commit();

            return {
                success: true,
                refundId: refund.id,
                amount: refund_amount,
                ticketCount: tickets.length
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Ошибка при создании заявки на возврат:', error);
            throw error;
        }
    }

    async sendRefundEmailToAdmin(refund, tickets) {
        try {
            const ticketList = tickets.map(ticket => 
                `- Билет №${ticket.ticket_number} (${ticket.ticket.title}): ${ticket.ticket.price} руб.`
            ).join('\n');

            const mailOptions = {
                from: 'ibra001@ibrokhim.ru',
                to: this.ADMIN_EMAIL,
                subject: `Новая заявка на возврат №${refund.id}`,
                text: `Поступила новая заявка на возврат средств:
                
                Данные заявителя:
                ФИО: ${refund.full_name}
                Email: ${refund.email}
                Телефон: ${refund.phone}

                Банковские реквизиты:
                Банк: ${refund.bank_name}
                Счет: ${refund.account_number}
                БИК: ${refund.bik}
                Корр. счет: ${refund.correspondent_account}
                ИНН: ${refund.inn}
                КПП: ${refund.kpp || 'не указан'}
                ОКПО: ${refund.okpo || 'не указан'}
                ОГРН: ${refund.ogrn || 'не указан'}

                Список билетов:
                ${ticketList}

                Общая сумма к возврату: ${refund.refund_amount} руб.

                Причина возврата: ${refund.refund_reason}

                Дата заявки: ${formatDate(refund.created_at)} ${formatTime(refund.created_at)}
                `,
                html: `
                <h1>Новая заявка на возврат №${refund.id}</h1>
                <p>Поступила новая заявка на возврат средств:</p>
                
                <h2>Данные заявителя:</h2>
                <ul>
                    <li><strong>ФИО:</strong> ${refund.full_name}</li>
                    <li><strong>Email:</strong> ${refund.email}</li>
                    <li><strong>Телефон:</strong> ${refund.phone}</li>
                </ul>
                
                <h2>Банковские реквизиты:</h2>
                <ul>
                    <li><strong>Банк:</strong> ${refund.bank_name}</li>
                    <li><strong>Счет:</strong> ${refund.account_number}</li>
                    <li><strong>БИК:</strong> ${refund.bik}</li>
                    <li><strong>Корр. счет:</strong> ${refund.correspondent_account}</li>
                    <li><strong>ИНН:</strong> ${refund.inn}</li>
                    <li><strong>КПП:</strong> ${refund.kpp || 'не указан'}</li>
                    <li><strong>ОКПО:</strong> ${refund.okpo || 'не указан'}</li>
                    <li><strong>ОГРН:</strong> ${refund.ogrn || 'не указан'}</li>
                </ul>
                
                <h2>Список билетов:</h2>
                <ul>
                    ${tickets.map(ticket => 
                        `<li>Билет №${ticket.ticket_number} (${ticket.ticket.title}): ${ticket.ticket.price} руб.</li>`
                    ).join('')}
                </ul>
                
                <p><strong>Общая сумма к возврату:</strong> ${refund.refund_amount} руб.</p>
                
                <h2>Причина возврата:</h2>
                <p>${refund.refund_reason}</p>
                
                <p><em>Дата заявки: ${formatDate(refund.created_at)} ${formatTime(refund.created_at)}</em></p>
                `
            };

            await this.transporter.sendMail(mailOptions);
        } catch (error) {
            console.error('Ошибка при отправке email администратору:', error);
            throw error;
        }
    }

    async sendClientConfirmation(refund, tickets) {
        try {
            const mailOptions = {
                from: '"Служба поддержки" <ibra001@ibrokhim.ru>',
                to: refund.email,
                subject: `Ваша заявка на возврат №${refund.id} принята`,
                text: `Уважаемый(ая) ${refund.full_name},

Ваша заявка на возврат средств №${refund.id} успешно зарегистрирована.

Детали заявки:
- Сумма к возврату: ${refund.refund_amount} руб.
- Количество билетов: ${tickets.length}
- Дата подачи: ${formatDate(refund.created_at)}

Мы обработаем вашу заявку в течение 30 рабочих дней.

С уважением,
Служба поддержки`,
                html: `
                <h1>Заявка на возврат №${refund.id} принята</h1>
                <p>Уважаемый(ая) ${refund.full_name},</p>
                <p>Ваша заявка на возврат средств успешно зарегистрирована.</p>
                
                <h2>Детали заявки:</h2>
                <ul>
                    <li><strong>Сумма к возврату:</strong> ${refund.refund_amount} руб.</li>
                    <li><strong>Количество билетов:</strong> ${tickets.length}</li>
                    <li><strong>Дата подачи:</strong> ${formatDate(refund.created_at)}</li>
                </ul>
                
                <p>Мы обработаем вашу заявку в течение 30 рабочих дней.</p>
                
                <p>С уважением,<br>Служба поддержки</p>
                `
            };

            await this.transporter.sendMail(mailOptions);
        } catch (error) {
            console.error('Ошибка при отправке подтверждения клиенту:', error);
        }
    }

    async getUserRefunds(userId) {
        try {
            return await Refund.findAll({
                where: { user_id: userId },
                include: [
                    {
                        model: UserTicket,
                        as: 'tickets',
                        include: ['ticket']
                    }
                ],
                order: [['created_at', 'DESC']]
            });
        } catch (error) {
            console.error('Ошибка при получении заявок на возврат:', error);
            throw error;
        }
    }

    async getRefundDetails(refundId, userId) {
        try {
            return await Refund.findOne({
                where: { id: refundId, user_id: userId },
                include: [
                    {
                        model: UserTicket,
                        as: 'tickets',
                        include: ['ticket']
                    }
                ]
            });
        } catch (error) {
            console.error('Ошибка при получении деталей заявки:', error);
            throw error;
        }
    }

    async getAllRefunds() {
        try {
            return await Refund.findAll({
                include: [
                    {
                        model: User,
                        as: 'user',
                        attributes: ['telegram_id', 'first_name', 'last_name', 'username']
                    },
                    {
                        model: UserTicket,
                        as: 'tickets',
                        include: ['ticket']
                    }
                ],
                order: [['created_at', 'DESC']]
            });
        } catch (error) {
            console.error('Ошибка при получении всех заявок:', error);
            throw error;
        }
    }

    async updateRefundStatus(refundId, status) {
        try {
            const refund = await Refund.findByPk(refundId);
            if (!refund) {
                throw new Error('Заявка не найдена');
            }

            refund.status = status;
            await refund.save();

            return refund;
        } catch (error) {
            console.error('Ошибка при обновлении статуса заявки:', error);
            throw error;
        }
    }
}

export default RefundClientService;