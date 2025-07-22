import axios from 'axios';
import dotenv from 'dotenv';
import { URLSearchParams } from 'url';
import base64 from 'base-64';
import { sendUserTicketEmail, sendAdminNotification } from './emailService.js';
import TicketService from './ticketService.js';

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

    async createInvoice(ticketData) {
        try {
            // 1. Получаем токен для создания счета
            const tokenResponse = await axios.post(
                `${this.PAYKEEPER_SERVER}/info/settings/token/`,
                {},
                { headers: this.headers, timeout: 10000 }
            );

            const token = tokenResponse.data?.token;
            if (!token) throw new Error('Failed to get token from PayKeeper');

            // 3. Формируем данные для счета
            const customerName = `${ticketData.customer.first_name} ${ticketData.customer.last_name}`.trim();
            const paymentParams = new URLSearchParams();

            paymentParams.append('pay_amount', ticketData.price);
            paymentParams.append('clientid', customerName.substring(0, 100));
            paymentParams.append('orderid', ticketData.id); // Используем ID билета как orderid
            paymentParams.append('service_name', `Билет: ${ticketData.event.title}`.substring(0, 100));
            paymentParams.append('client_email', ticketData.customer.email);
            paymentParams.append('client_phone', ticketData.customer.phone);
            paymentParams.append('token', token);
            paymentParams.append('payment_currency', 'RUB');
            paymentParams.append('payment_details', `Билет №${ticketData.id}`);

            // 4. Создаем счет в PayKeeper
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

    async checkPaymentStatus(invoiceId) {
        try {
            const response = await axios.get(
                `${this.PAYKEEPER_SERVER}/info/invoice/status/?id=${invoiceId}`,
                { headers: this.headers, timeout: 10000 }
            );

            return response.data?.status === 'paid';
        } catch (error) {
            console.error('Payment status check error:', error);
            return false;
        }
    }

    async handleSuccessfulPayment(invoiceId, userData) {
        try {
            // 1. Подтверждаем оплату в TicketService
            const ticket = await TicketService.confirmPayment(invoiceId);

            if (!ticket) {
                throw new Error('Ticket not found for this payment');
            }

            // 2. Подготавливаем данные для email
            const ticketData = {
                number: ticket.id,
                event: {
                    title: ticket.event.title,
                    date: ticket.event.date,
                    time: ticket.event.time,
                    location: ticket.event.location
                },
                customer: {
                    name: `${userData.first_name} ${userData.last_name}`,
                    phone: userData.phone,
                    email: userData.email
                },
                price: ticket.price,
                invoiceId: invoiceId
            };

            // 3. Отправляем email пользователю
            await sendUserTicketEmail(userData.email, ticketData);

            // 4. Отправляем уведомление администратору
            await sendAdminNotification('zakaz@dali-khinkali.ru', ticketData);

            return { success: true, ticket };

        } catch (error) {
            console.error('Payment handling error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new PaymentService();