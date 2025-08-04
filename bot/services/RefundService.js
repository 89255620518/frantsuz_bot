// RefundService.js
import axios from 'axios';
import base64 from 'base-64';
import { URLSearchParams } from 'url';
import { UserTicket } from '../models/UserTicket.js';
import { Ticket } from '../models/Event.js';
import { Op } from 'sequelize';
import PaymentService from './paykeeper.js';

class RefundService {
    constructor() {
        this.paymentService = PaymentService;
        this.PAYKEEPER_USER = process.env.PAYKEEPER_USER;
        this.PAYKEEPER_PASSWORD = process.env.PAYKEEPER_PASSWORD;
        this.PAYKEEPER_SERVER = process.env.PAYKEEPER_SERVER?.replace(/\/$/, '');
        
        this.initHeaders();
    }

    initHeaders() {
        const authString = `${this.PAYKEEPER_USER}:${this.PAYKEEPER_PASSWORD}`;
        this.headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${base64.encode(authString)}`
        };
    }

    async getSecurityToken() {
        try {
            const response = await axios.post(
                `${this.PAYKEEPER_SERVER}/info/settings/token/`,
                {},
                { headers: this.headers, timeout: 10000 }
            );
            return response.data?.token;
        } catch (error) {
            console.error('Ошибка получения токена:', error);
            throw new Error('Не удалось получить токен безопасности');
        }
    }

    async verifyPaymentStatus(paymentId) {
        try {
            const statusResponse = await this.paymentService.getPaymentStatus(paymentId);
            
            if (!statusResponse.success) {
                throw new Error(statusResponse.error || 'Не удалось проверить статус платежа');
            }

            const allowedStatuses = ['paid', 'succeeded', 'received', 'retry_exceeded'];
            
            return allowedStatuses.includes(statusResponse.status);

        } catch (error) {
            console.error('Ошибка проверки статуса платежа:', error);
            throw new Error('Не удалось проверить статус платежа');
        }
    }

    async fullEventRefund(eventId) {
        const transaction = await UserTicket.sequelize.transaction();
        try {
            const event = await Ticket.findByPk(eventId, { transaction });
            if (!event) {
                throw new Error('Мероприятие не найдено');
            }

            const tickets = await UserTicket.findAll({
                where: {
                    payment_status: 'paid',
                    payment_id: { [Op.not]: null }
                },
                include: [{
                    model: Ticket,
                    as: 'ticket',
                    where: { id: eventId }
                }],
                transaction
            });

            if (!tickets.length) {
                return { 
                    success: true, 
                    eventTitle: event.title,
                    refundedCount: 0,
                    totalAmount: 0,
                    message: 'Нет билетов для возврата' 
                };
            }

            const results = [];
            let totalAmount = 0;
            
            for (const ticket of tickets) {
                try {
                    const isPaymentValid = await this.verifyPaymentStatus(ticket.payment_id);
                    if (!isPaymentValid) {
                        throw new Error('Статус платежа не позволяет сделать возврат');
                    }

                    const refundResult = await this.processPayKeeperRefund({
                        paymentId: ticket.payment_id,
                        amount: ticket.ticket.price,
                        isFullRefund: true
                    });

                    if (refundResult.success) {
                        await ticket.update({
                            payment_status: 'refunded',
                            refund_amount: ticket.ticket.price,
                            refund_date: new Date()
                        }, { transaction });
                        totalAmount += parseFloat(ticket.ticket.price);
                    }

                    results.push(refundResult);
                } catch (error) {
                    results.push({
                        success: false,
                        error: error.message,
                        ticketId: ticket.id
                    });
                }
            }

            await transaction.commit();

            const successCount = results.filter(r => r.success).length;
            return {
                success: successCount === tickets.length,
                eventTitle: event.title,
                refundedCount: successCount,
                totalAmount: totalAmount.toFixed(2),
                errors: results.filter(r => !r.success).map(r => r.error)
            };

        } catch (error) {
            await transaction.rollback();
            console.error('Ошибка полного возврата:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async processPayKeeperRefund({ paymentId, amount, isFullRefund }) {
        try {
            const token = await this.getSecurityToken();
            if (!token) {
                throw new Error('Не удалось получить токен безопасности');
            }

            const refundParams = new URLSearchParams();
            refundParams.append('id', paymentId);
            refundParams.append('amount', amount);
            refundParams.append('partial', !isFullRefund);
            refundParams.append('token', token);

            const response = await axios.post(
                `${this.PAYKEEPER_SERVER}/change/payment/reverse/`,
                refundParams,
                { headers: this.headers, timeout: 15000 }
            );

            if (response.data?.result !== 'success') {
                throw new Error(response.data?.msg || 'Неизвестная ошибка возврата');
            }

            return { success: true };

        } catch (error) {
            console.error(`Ошибка возврата для платежа ${paymentId}:`, error);
            const errorMessage = error.response?.data?.msg || error.message;
            
            if (errorMessage.includes('Нельзя сделать возврат по платежу, статус которого не "совершён"')) {
                return {
                    success: false,
                    error: 'Платеж имеет неподходящий статус для возврата. Требуется статус "совершён", "получен" или "превышено число повторов"'
                };
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    async checkRefundEligibility(ticketId) {
        try {
            const ticket = await UserTicket.findOne({
                where: { id: ticketId },
                include: [{
                    model: Ticket,
                    as: 'ticket'
                }]
            });

            if (!ticket) {
                return { eligible: false, reason: 'Билет не найден' };
            }

            if (ticket.payment_status !== 'paid') {
                return { eligible: false, reason: 'Билет не оплачен' };
            }

            const eventDate = new Date(ticket.ticket.event_date);
            const now = new Date();
            const daysDiff = Math.floor((eventDate - now) / (1000 * 60 * 60 * 24));

            let refundPercent = 0;
            if (daysDiff > 7) {
                refundPercent = 80;
            } else if (daysDiff >= 3) {
                refundPercent = 50;
            } else {
                return { 
                    eligible: false, 
                    reason: 'Возврат возможен только за 3 и более дней до мероприятия' 
                };
            }

            return {
                eligible: true,
                refundPercent,
                maxRefundAmount: (ticket.ticket.price * refundPercent / 100).toFixed(2),
                eventDate: ticket.ticket.event_date
            };

        } catch (error) {
            console.error('Ошибка проверки возврата:', error);
            return {
                eligible: false,
                reason: 'Ошибка при проверке возможности возврата'
            };
        }
    }
}

export default RefundService;