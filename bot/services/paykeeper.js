import axios from 'axios';
import dotenv from 'dotenv';
import { URLSearchParams } from 'url';
import base64 from 'base-64';
import { UserTicket } from '../models/UserTicket.js';
import { Order } from '../models/Orders.js';
import { OrderItem } from '../models/OrderItem.js';
import { Ticket } from '../models/Event.js';
import { Op } from 'sequelize';
import { sendTicketsToCustomer, notifyAdminAboutOrder } from './emailService.js';

dotenv.config();

class PaymentService {
    constructor() {
        this.PAYKEEPER_USER = process.env.PAYKEEPER_USER;
        this.PAYKEEPER_PASSWORD = process.env.PAYKEEPER_PASSWORD;
        this.PAYKEEPER_SERVER = process.env.PAYKEEPER_SERVER?.replace(/\/$/, '');

        this.validateConfig();
        this.initHeaders();
    }

    validateConfig() {
        if (!this.PAYKEEPER_USER || !this.PAYKEEPER_PASSWORD || !this.PAYKEEPER_SERVER) {
            throw new Error('PayKeeper configuration is missing in .env file');
        }
    }

    initHeaders() {
        const authString = `${this.PAYKEEPER_USER}:${this.PAYKEEPER_PASSWORD}`;
        this.headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${base64.encode(authString)}`
        };
    }

    async initialize() {
        console.log('Connecting to PayKeeper...');
        try {
            const response = await axios.get(`${this.PAYKEEPER_SERVER}/info/`, {
                headers: this.headers,
                timeout: 5000
            });

            if (response.data?.status === 'ok') {
                console.log('Successfully connected to PayKeeper');
                return true;
            }
            throw new Error('Invalid PayKeeper response');
        } catch (error) {
            console.error('PayKeeper connection error:', error.message);
            return false;
        }
    }

    /**
     * Создает счет в PayKeeper и привязывает его к билету
     */
    async createInvoice(ticketData) {
        try {
            // 1. Получаем токен
            const tokenResponse = await axios.post(
                `${this.PAYKEEPER_SERVER}/info/settings/token/`,
                {},
                { headers: this.headers, timeout: 10000 }
            );

            const token = tokenResponse.data?.token;
            if (!token) throw new Error('Failed to get token from PayKeeper');

            // 2. Формируем данные для счета
            const customerName = `${ticketData.customer.first_name} ${ticketData.customer.last_name}`.trim();
            const paymentParams = new URLSearchParams();

            paymentParams.append('pay_amount', ticketData.price);
            paymentParams.append('clientid', customerName.substring(0, 100));
            paymentParams.append('orderid', ticketData.id);
            paymentParams.append('service_name', `Билет: ${ticketData.event.title}`.substring(0, 100));
            paymentParams.append('client_email', ticketData.customer.email);
            paymentParams.append('client_phone', ticketData.customer.phone);
            paymentParams.append('token', token);
            paymentParams.append('payment_currency', 'RUB');

            // 3. Создаем счет
            const invoiceResponse = await axios.post(
                `${this.PAYKEEPER_SERVER}/change/invoice/preview/`,
                paymentParams,
                { headers: this.headers, timeout: 15000 }
            );

            const invoiceId = invoiceResponse.data?.invoice_id;
            if (!invoiceId) throw new Error('Failed to get invoice ID');

            return {
                success: true,
                paymentId: invoiceId,
                paymentUrl: `${this.PAYKEEPER_SERVER}/bill/${invoiceId}/`,
                ticketId: ticketData.id
            };

        } catch (error) {
            console.error('Invoice creation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Получает статус платежа по invoice_id
     */
    async getPaymentStatus(invoiceId) {
        try {
            const response = await axios.get(
                `${this.PAYKEEPER_SERVER}/info/invoice/byid/?id=${invoiceId}`,
                { headers: this.headers, timeout: 10000 }
            );

            if (!response.data || !response.data.status) {
                throw new Error('Invalid response from PayKeeper');
            }

            return {
                success: true,
                status: response.data.status,
                amount: response.data.pay_amount,
                orderId: response.data.orderid,
                paymentDate: response.data.paid_at,
                clientEmail: response.data.client_email,
                clientPhone: response.data.client_phone
            };
        } catch (error) {
            console.error('Payment status check error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Обрабатывает успешный платеж
     */
    async processSuccessfulPayment(invoiceId) {
        const transaction = await UserTicket.sequelize.transaction();
        try {
            // 1. Находим все билеты по payment_id с связанными данными
            const userTickets = await UserTicket.findAll({
                where: { payment_id: invoiceId },
                include: [
                    {
                        model: Ticket,
                        as: 'ticket',
                        attributes: ['id', 'title', 'description', 'event_date', 'event_location', 'price']
                    },
                    {
                        model: OrderItem,
                        as: 'order_item',
                        include: [{
                            model: Order,
                            as: 'order',
                            attributes: ['id', 'user_id', 'first_name', 'last_name', 'email', 'phone', 'total_amount', 'created_at']
                        }]
                    }
                ],
                transaction
            });

            if (!userTickets || userTickets.length === 0) {
                throw new Error('UserTickets not found for this payment');
            }

            // 2. Обновляем статус всех билетов
            await Promise.all(userTickets.map(ticket =>
                ticket.update({
                    payment_status: 'paid',
                    expires_at: null,
                }, { transaction })
            ));

            await transaction.commit();

            // 3. Группируем билеты по заказам (должен быть только один заказ на invoiceId)
            const ordersMap = new Map();
            
            userTickets.forEach(ticket => {
                const order = ticket.order_item?.order;
                if (order && !ordersMap.has(order.id)) {
                    ordersMap.set(order.id, {
                        orderData: order,
                        tickets: userTickets // Все билеты этого платежа
                    });
                }
            });

            // 4. Отправляем уведомления
            for (const [orderId, orderInfo] of ordersMap) {
                const { orderData, tickets } = orderInfo;

                // Отправка пользователю - все билеты одним письмом
                try {
                    await sendTicketsToCustomer(
                        orderData.email,
                        orderData,
                        tickets
                    );
                } catch (emailError) {
                    console.error('Ошибка отправки билетов пользователю:', emailError);
                }

                // Отправка администратору - все билеты одним письмом
                try {
                    await notifyAdminAboutOrder(
                        orderData,
                        tickets
                    );
                } catch (adminEmailError) {
                    console.error('Ошибка отправки уведомления администратору:', adminEmailError);
                }
            }

            return {
                success: true,
                userTickets: userTickets
            };

        } catch (error) {
            await transaction.rollback();
            console.error('Payment processing error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Обрабатывает отмену платежа
     */
    async cancelPayment(invoiceId) {
        try {
            const userTicket = await UserTicket.findAll({
                where: { payment_id: invoiceId }
            });

            if (userTicket) {
                await Promise.all(userTickets.map(ticket =>
                    ticket.update({
                        payment_status: 'canceled'
                    })
                ));
            }

            return { success: true };
        } catch (error) {
            console.error('Cancel payment error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Проверяет статус платежа и отправляет уведомление
     */
    async checkPaymentAndNotify(invoiceId, notifyCallback) {
        try {
            // 1. Проверяем статус платежа
            const status = await this.getPaymentStatus(invoiceId);
            if (!status.success) {
                await notifyCallback(`Ошибка при проверке платежа: ${status.error}`);
                return false;
            }

            // 2. Обрабатываем статус
            switch (status.status) {
                case 'paid':
                    const processResult = await this.processSuccessfulPayment(invoiceId);
                    if (processResult.success) {
                        const tickets = processResult.userTickets;

                        // Базовое сообщение
                        let message = `✅ Платеж успешно завершен!\n` +
                            `💳 Сумма: ${status.amount} RUB\n` +
                            `📅 Дата оплаты: ${new Date().toLocaleString()}\n\n` +
                            `🎫 Полученные билеты (${tickets.length} шт.):\n`;

                        // Добавляем информацию о каждом билете
                        tickets.forEach((ticket, index) => {
                            message += `\n${index + 1}. Номер билета: ${ticket.ticket_number}\n` +
                                `   Дата создания: ${new Date(ticket.created_at).toLocaleString()}\n` +
                                `   Статус: ${ticket.is_used ? 'Использован' : 'Активен'}\n`;
                        });

                        await notifyCallback(message);
                        return true;
                    } else {
                        await notifyCallback(`Ошибка обработки платежа: ${processResult.error}`);
                        return false;
                    }

                case 'pending':
                    await notifyCallback('⏳ Платеж еще не поступил. Если вы уже оплатили, подождите 5-10 минут.');
                    return false;

                case 'canceled':
                    await this.cancelPayment(invoiceId);
                    await notifyCallback('❌ Платеж был отменен. Вы можете создать новый заказ.');
                    return false;

                default:
                    await notifyCallback(`Неизвестный статус платежа: ${status.status}`);
                    return false;
            }
        } catch (error) {
            console.error('Payment check error:', error);
            await notifyCallback('⚠ Произошла ошибка при проверке платежа');
            return false;
        }
    }

    /**
     * Настраивает автоматическую проверку платежа
     */
    async setupPaymentAutoCheck(invoiceId, notifyCallback, intervalMinutes = 2) {
        const checkInterval = setInterval(async () => {
            try {
                const result = await this.checkPaymentAndNotify(invoiceId, notifyCallback);

                if (result) {
                    clearInterval(checkInterval);
                }

                // Дополнительная проверка - если билет уже оплачен, прекращаем проверку
                const userTicket = await UserTicket.findOne({
                    where: { payment_id: invoiceId }
                });

                if (userTicket && userTicket.payment_status === 'paid') {
                    clearInterval(checkInterval);
                }
            } catch (error) {
                console.error('Auto check error:', error);
            }
        }, intervalMinutes * 60 * 1000);

        return checkInterval;
    }

    /**
     * Проверяет все pending платежи (для cron job)
     */
    async checkAllPendingPayments(notifyCallback) {
        try {
            const pendingTickets = await UserTicket.findAll({
                where: {
                    payment_status: 'pending',
                    expires_at: { [Op.gt]: new Date() },
                    payment_id: { [Op.not]: null }
                }
            });

            for (const ticket of pendingTickets) {
                await this.checkPaymentAndNotify(ticket.payment_id, notifyCallback);
            }

            return { success: true, checked: pendingTickets.length };
        } catch (error) {
            console.error('Error checking pending payments:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Отменяет просроченные платежи (для cron job)
     */
    async cancelExpiredPayments(notifyCallback) {
        try {
            const expiredTickets = await UserTicket.findAll({
                where: {
                    payment_status: 'pending',
                    expires_at: { [Op.lt]: new Date() },
                    payment_id: { [Op.not]: null }
                }
            });

            for (const ticket of expiredTickets) {
                await this.cancelPayment(ticket.payment_id);
                await notifyCallback(
                    `⌛ Время оплаты билета ${ticket.ticket_number} истекло.\n` +
                    `Заказ был автоматически отменен. Вы можете создать новый заказ.`,
                    ticket.telegram_chat_id
                );
            }

            return { success: true, canceled: expiredTickets.length };
        } catch (error) {
            console.error('Error canceling expired payments:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new PaymentService();