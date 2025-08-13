import axios from 'axios';
import base64 from 'base-64';
import { URLSearchParams } from 'url';
import { UserTicket } from '../models/UserTicket.js';
import { Ticket } from '../models/Event.js';
import { Order } from '../models/Orders.js';
import { OrderItem } from '../models/OrderItem.js';
import { User } from '../models/User.js';
import { Op, Sequelize } from 'sequelize';

class RefundService {
    constructor() {
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
            console.error('Ошибка получения токена безопасности:', error.message);
            throw new Error('Не удалось получить токен безопасности');
        }
    }

    async getExistingRefunds(paymentId) {
        try {
            const response = await axios.get(
                `${this.PAYKEEPER_SERVER}/info/refunds/bypaymentid/?id=${paymentId}`,
                { headers: this.headers, timeout: 10000 }
            );
            return response.data || [];
        } catch (error) {
            console.error(`Ошибка получения информации о возвратах для платежа ${paymentId}:`, error.message);
            return [];
        }
    }

    async getPaymentDetails(paymentId, advanced = false) {
        try {
            const url = `${this.PAYKEEPER_SERVER}/info/invoice/byid/?id=${paymentId}${
                advanced ? '&advanced=true' : ''
            }`;

            console.log(`Запрос деталей платежа ${paymentId}`, { url, advanced });

            const response = await axios.get(url, {
                headers: this.headers,
                timeout: 10000,
                validateStatus: (status) => status < 500 // Принимаем все статусы кроме 5xx
            });

            console.log(`Ответ от PayKeeper для платежа ${paymentId}:`, {
                response
            });

            // Если ответ не содержит данных
            if (!response.data) {
                throw new Error('Пустой ответ от сервера PayKeeper');
            }

            // Обрабатываем разные форматы ответа
            let paymentData;
            if (response.status === 200) {
                if (!response.data) {
                    throw new Error('Пустой ответ от сервера');
                }

                // Обрабатываем разные форматы ответа
                if (Array.isArray(response.data)) {
                    paymentData = response.data[0]; // Берем первый элемент массива
                } else if (typeof response.data === 'object') {
                    paymentData = response.data;
                } else {
                    throw new Error(`Неожиданный формат данных: ${typeof response.data}`);
                }
            } else if (response.status === 404) {
                throw new Error('Платеж не найден');
            } else {
                throw new Error(`HTTP статус ${response.status}`);
            }

            // Проверяем наличие обязательных полей
            const requiredFields = ['id', 'pay_amount', 'status'];
            const missingFields = requiredFields.filter(field => !paymentData[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Отсутствуют обязательные поля: ${missingFields.join(', ')}`);
            }

            console.log(`Данные платежа ${paymentId}:`, {
                status: paymentData.status,
                payAmount: paymentData.pay_amount,
                refundAmount: paymentData.refund_amount || '0.00',
                client: paymentData.clientid,
                paymentSystem: paymentData.system_description,
                dates: {
                    created: paymentData.pending_datetime,
                    processed: paymentData.obtain_datetime,
                    completed: paymentData.success_datetime
                }
            });

            const result = {
                success: true,
                id: paymentData.id,
                status: paymentData.status,
                rawStatus: paymentData.status,
                payAmount: parseFloat(paymentData.pay_amount),
                refundAmount: parseFloat(paymentData.refund_amount || '0'),
                availableForRefund: parseFloat(paymentData.pay_amount) - parseFloat(paymentData.refund_amount || '0'),
                clientId: paymentData.clientid,
                orderId: paymentData.orderid,
                paymentSystem: paymentData.system_description,
                dates: {
                    created: paymentData.pending_datetime,
                    processed: paymentData.obtain_datetime,
                    completed: paymentData.success_datetime
                },
                rawData: paymentData
            };

            if (advanced) {
                result.cardNumber = paymentData.CARD_NUMBER;
                result.approvalCode = paymentData.APPROVAL_CODE;
                result.secure3D = paymentData['3DSECURE'];
                result.rrn = paymentData.RRN;
            }

            console.log(`Данные платежа ${paymentId}:`, result);
            return result;
        } catch (error) {
            console.error(`Ошибка получения данных платежа ${paymentId}:`, {
                error: error.message,
                response: error.response?.data,
                config: error.config
            });
            
            // Возвращаем более информативное сообщение об ошибке
            let errorMessage = error.message;
            if (error.response) {
                if (error.response.status === 404) {
                    errorMessage = 'Платеж не найден в системе PayKeeper';
                } else if (error.response.status === 403) {
                    errorMessage = 'Доступ к информации о платеже запрещен';
                } else if (error.response.data) {
                    errorMessage += ` (Данные сервера: ${JSON.stringify(error.response.data)})`;
                }
            }

            return {
                success: false,
                error: errorMessage,
                details: error.response?.data
            };
        }
    }

    async getPaymentInfo(paymentId) {
        try {
            const response = await axios.get(
                `${this.PAYKEEPER_SERVER}/info/invoice/byid/?id=${paymentId}`,
                { headers: this.headers, timeout: 10000 }
            );

            console.log('Получен ответ от PayKeeper:', response.data);

            if (!response.data) {
                throw new Error('Пустой ответ от PayKeeper');
            }

            const statusMap = {
                'paid': 'Совершён',
                'оплачен': 'Совершён',
                'completed': 'Совершён',
                'paid_partial': 'частично оплачен',
                'created': 'создан',
                'expired': 'истек',
                'received': 'получен',
                'retry_exceeded': 'превышено число повторов'
            };

            const status = statusMap[response.data.status] || response.data.status;

            return {
                success: true,
                id: response.data.id,
                status: status,
                rawStatus: response.data.status,
                amount: parseFloat(response.data.pay_amount),
                orderId: response.data.orderid,
                paymentDate: response.data.paid_datetime,
                clientEmail: response.data.client_email,
                clientPhone: response.data.client_phone,
                hasCart: !!response.data.cart
            };
        } catch (error) {
            console.error(`Ошибка получения информации о платеже ${paymentId}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async isRefundPossible(paymentId) {
        // Сначала пробуем новый метод
        let paymentDetails = await this.getPaymentDetails(paymentId, true);
        
        // Если новый метод не сработал, пробуем старый
        if (!paymentDetails.success) {
            console.log(`Пробуем старый метод для платежа ${paymentId}`);
            const oldMethodResult = await this.getPaymentInfo(paymentId);
            
            if (!oldMethodResult.success) {
                return {
                    possible: false,
                    reason: oldMethodResult.error || 'Не удалось проверить статус платежа'
                };
            }
            
            paymentDetails = {
                success: true,
                id: oldMethodResult.id,
                status: oldMethodResult.status,
                rawStatus: oldMethodResult.rawStatus,
                payAmount: oldMethodResult.amount,
                refundAmount: 0,
                availableForRefund: oldMethodResult.amount,
                clientId: oldMethodResult.orderId,
                orderId: oldMethodResult.orderId,
                rawData: {
                    status: oldMethodResult.rawStatus,
                    cart: oldMethodResult.hasCart ? [] : undefined
                }
            };
        }

        const existingRefunds = await this.getExistingRefunds(paymentId);
        const hasPendingRefunds = existingRefunds.some(r => r.status === 'started');
        
        if (hasPendingRefunds) {
            return {
                possible: false,
                reason: 'По этому платежу уже есть незавершенный возврат'
            };
        }

        const allowedForRefundStatuses = [
            'success', 'paid', 'оплачен', 'Совершён', 
            'completed', 'received', 'retry_exceeded'
        ];

        if (!allowedForRefundStatuses.includes(paymentDetails.rawStatus)) {
            const statusMap = {
                'success': 'Успешный',
                'paid': 'Совершён',
                'оплачен': 'Совершён',
                'completed': 'Совершён',
                'paid_partial': 'частично оплачен',
                'created': 'создан',
                'expired': 'истек',
                'received': 'получен',
                'retry_exceeded': 'превышено число повторов'
            };

            const statusName = statusMap[paymentDetails.rawStatus] || paymentDetails.rawStatus;
            
            return {
                possible: false,
                reason: `Нельзя сделать возврат для платежа со статусом "${statusName}"`
            };
        }

        const refundedAmount = existingRefunds
            .filter(r => r.status === 'done')
            .reduce((sum, r) => sum + parseFloat(r.amount), 0);
        
        const availableAmount = paymentDetails.payAmount - refundedAmount;

        console.log(`Доступная сумма для возврата ${paymentId}:`, {
            payAmount: paymentDetails.payAmount,
            alreadyRefunded: refundedAmount,
            availableForRefund: availableAmount
        });

        return {
            possible: true,
            maxAmount: parseFloat(availableAmount.toFixed(2)),
            paymentStatus: paymentDetails.status,
            alreadyRefunded: parseFloat(refundedAmount.toFixed(2)),
            hasCart: paymentDetails.rawData.cart !== undefined
        };
    }

    async checkRefundStatus(paymentId) {
        try {
            // Пробуем оба метода получения информации
            const paymentDetails = await this.getPaymentDetails(paymentId);
        
            // Если не удалось, пробуем старый метод
            if (!paymentDetails.success) {
                console.log(`Пробуем старый метод для проверки статуса платежа ${paymentId}`);
                const oldMethodResult = await this.getPaymentInfo(paymentId);
                
                if (!oldMethodResult.success) {
                    return oldMethodResult;
                }
                
                return {
                    success: true,
                    status: oldMethodResult.status,
                    bank_status: 'unknown',
                    can_refund: true, // Предполагаем, что возврат возможен
                    available_for_refund: oldMethodResult.amount,
                    existing_refunds: [],
                    last_refund: null
                };
            }

            const existingRefunds = await this.getExistingRefunds(paymentId);
            const lastRefund = existingRefunds[existingRefunds.length - 1];
            
            console.log(`Статус возврата для платежа ${paymentId}:`, {
                status: paymentDetails.status,
                bank_status: paymentDetails.rawData?.bank_status,
                available_for_refund: paymentDetails.availableForRefund,
                existing_refunds: existingRefunds.length,
                last_refund: lastRefund
            });

            return {
                success: true,
                status: paymentDetails.status,
                bank_status: paymentDetails.rawData?.bank_status,
                can_refund: paymentDetails.availableForRefund > 0,
                available_for_refund: paymentDetails.availableForRefund,
                existing_refunds: existingRefunds,
                last_refund: lastRefund
            };
        } catch (error) {
            console.error(`Ошибка проверки статуса возврата для платежа ${paymentId}:`, {
                error: error.message,
                stack: error.stack
            });
            return {
                success: false,
                error: error.message
            };
        }
    }

    async buildRefundCartForEvent(paymentId, eventId) {
        try {
            const tickets = await UserTicket.findAll({
                where: { 
                    payment_id: paymentId,
                    ticket_id: eventId
                },
                include: [
                    {
                        model: OrderItem,
                        as: 'order_item',
                        required: true,
                        attributes: ['quantity']
                    },
                    {
                        model: Ticket,
                        as: 'ticket',
                        required: true,
                        attributes: ['title', 'price']
                    }
                ]
            });

            console.log(`Найдено билетов для возврата ${paymentId}:`, tickets.length);

            const cartItems = tickets.map(ticket => {
                const price = parseFloat(ticket.ticket.price);
                const quantity = ticket.order_item.quantity || 1;
                const sum = (price * quantity).toFixed(2);

                return {
                    name: ticket.ticket.title || `Билет №${ticket.ticket_number}`,
                    price: price.toFixed(2),
                    quantity: quantity,
                    sum: sum,
                    vat: "vat20",
                    type: "position"
                };
            });

            console.log(`Сформирована корзина для возврата платежа ${paymentId}:`, cartItems);
            return cartItems;
        } catch (error) {
            console.error(`Ошибка формирования корзины для возврата ${paymentId}:`, {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async processRefundForEvent({ paymentId, amount, isPartial, eventId }) {
        try {
            console.log(`Начало обработки возврата для платежа ${paymentId}, сумма: ${amount}, частичный: ${isPartial}`);

            const refundStatus = await this.checkRefundStatus(paymentId);
            console.log('Статус возврата платежа:', refundStatus);

            if (!refundStatus.success) {
                throw new Error(`Ошибка проверки статуса возврата: ${refundStatus.error}`);
            }

            const paymentDetails = await this.getPaymentDetails(paymentId) || 
                                 await this.getPaymentInfo(paymentId);
            const refundPossible = await this.isRefundPossible(paymentId);
            
            if (!refundPossible.possible) {
                throw new Error(refundPossible.reason);
            }

            if (amount <= 0) {
                throw new Error('Сумма возврата должна быть больше нуля');
            }

            if (amount > refundPossible.maxAmount) {
                throw new Error(`Сумма возврата (${amount}) превышает доступную сумму (${refundPossible.maxAmount}). Уже возвращено: ${refundPossible.alreadyRefunded || 0}`);
            }

            const token = await this.getSecurityToken();
            if (!token) {
                throw new Error('Не удалось получить токен безопасности');
            }
            console.log(token, 'token')

            const refundCart = await this.buildRefundCartForEvent(paymentId, eventId);
            const cartTotal = refundCart.reduce((sum, item) => sum + parseFloat(item.sum), 0);

            if (Math.abs(cartTotal - amount) > 0.01) {
                console.error(`Несоответствие суммы корзины (${cartTotal}) и суммы возврата (${amount})`);
                throw new Error(`Сумма корзины (${cartTotal}) не соответствует запрашиваемой сумме возврата (${amount})`);
            }

            const refundParams = new URLSearchParams();
            refundParams.append('id', paymentId);
            refundParams.append('amount', amount.toFixed(2));
            refundParams.append('partial', isPartial ? 'true' : 'false');
            refundParams.append('token', token);
            refundParams.append('refund_cart', JSON.stringify(refundCart));

            console.log('Отправляемые параметры возврата:', {
                paymentId,
                amount,
                isPartial,
                refundCart
            });

            const response = await axios.post(
                `${this.PAYKEEPER_SERVER}/change/payment/reverse/`,
                refundParams,
                {
                    headers: this.headers,
                    timeout: 15000,
                    validateStatus: () => true
                }
            );

            console.log('Ответ от PayKeeper:', response);

            if (!response.data) {
                throw new Error('Пустой ответ от PayKeeper');
            }

            if (response.data.result !== 'success') {
                const errorMsg = response.data.msg || 'Неизвестная ошибка при возврате';
                throw new Error(errorMsg);
            }

            return {
                success: true,
                paymentId,
                amount,
                isPartial,
                message: 'Запрос на возврат успешно отправлен. Возврат выполняется асинхронно.',
                needVerification: true,
                refundCart
            };

        } catch (error) {
            console.error(`Ошибка возврата ${paymentId}:`, {
                error: error.message,
                stack: error.stack
            });
            return {
                success: false,
                error: error.message,
                paymentId
            };
        }
    }

    async refundEventTickets(eventId) {
        const transaction = await UserTicket.sequelize.transaction();
        
        try {
            console.log(`Начало обработки возвратов для мероприятия ID: ${eventId}`);
            
            const event = await Ticket.findByPk(eventId, { 
                transaction,
                include: [{
                    model: UserTicket,
                    as: 'user_tickets',
                    where: { 
                        payment_status: 'paid',
                        payment_id: { [Op.not]: null }
                    },
                    include: [{
                        model: OrderItem,
                        as: 'order_item',
                        required: true,
                        attributes: ['id', 'quantity'],
                        include: [{
                            model: Order,
                            as: 'order',
                            required: true,
                            include: [{
                                model: User,
                                as: 'user',
                                required: true
                            }]
                        }]
                    }, {
                        model: Ticket,
                        as: 'ticket',
                        attributes: ['title', 'price']
                    }]
                }]
            });

            if (!event) {
                throw new Error('Мероприятие не найдено');
            }

            const tickets = event.user_tickets;
            const totalTicketsCount = tickets.reduce((sum, ticket) => sum + (ticket.order_item?.quantity || 1), 0);

            console.log(`Найдено ${tickets.length} записей билетов (${totalTicketsCount} шт. с учетом quantity) для возврата`);

            if (tickets.length === 0) {
                return { 
                    success: true, 
                    message: 'Нет билетов для возврата',
                    eventTitle: event.title,
                    refundedCount: 0,
                    totalAmount: 0
                };
            }

            const paymentsMap = {};
            const ticketPrice = parseFloat(event.price);

            tickets.forEach(ticket => {
                const paymentId = ticket.payment_id;
                const quantity = ticket.order_item.quantity || 1;
                
                if (!paymentsMap[paymentId]) {
                    paymentsMap[paymentId] = {
                        paymentId,
                        tickets: [],
                        users: new Map(),
                        totalForEvent: 0,
                        totalQuantity: 0
                    };
                }

                const userId = ticket.order_item.order.user.telegram_id;
                const userFullName = `${ticket.order_item.order.user.first_name} ${ticket.order_item.order.user.last_name}`;
                
                if (!paymentsMap[paymentId].users.has(userId)) {
                    paymentsMap[paymentId].users.set(userId, {
                        fullName: userFullName,
                        quantity: 0,
                        amount: 0
                    });
                }

                const userData = paymentsMap[paymentId].users.get(userId);
                userData.quantity += quantity;
                userData.amount += ticketPrice * quantity;

                paymentsMap[paymentId].tickets.push({
                    ...ticket.get({ plain: true }),
                    quantity
                });
                
                paymentsMap[paymentId].totalForEvent += ticketPrice * quantity;
                paymentsMap[paymentId].totalQuantity += quantity;
            });

            for (const paymentId of Object.keys(paymentsMap)) {
                const paymentData = paymentsMap[paymentId];

                const existingRefunds = await this.getExistingRefunds(paymentId);
                paymentsMap[paymentId].existingRefunds = existingRefunds;
                
                if (existingRefunds.length > 0) {
                    console.log(`Найдены существующие возвраты для платежа ${paymentId}:`, existingRefunds);
                }

                const allTicketsForPayment = await UserTicket.findAll({
                    where: { payment_id: paymentId },
                    include: [{
                        model: OrderItem,
                        as: 'order_item',
                        required: true,
                        attributes: ['quantity']
                    }, {
                        model: Ticket,
                        as: 'ticket',
                        attributes: ['id', 'price']
                    }],
                    transaction
                });

                const totalPaymentQuantity = allTicketsForPayment.reduce(
                    (sum, t) => sum + (t.order_item.quantity || 1), 0
                );

                paymentData.isPartial = totalPaymentQuantity > paymentData.totalQuantity;

                console.log(`Детализация пользователей для платежа ${paymentId}:`, {
                    isPartial: paymentData.isPartial,
                    totalUsers: paymentData.users.size,
                    users: Array.from(paymentData.users.values()).map(user => ({
                        name: user.fullName,
                        quantity: user.quantity,
                        amount: user.amount,
                        type: paymentData.isPartial ? 'частичный возврат' : 'полный возврат'
                    }))
                });

                console.log(`Платеж ${paymentId}:`, {
                    totalTickets: allTicketsForPayment.length,
                    totalPaymentQuantity,
                    ticketsForThisEvent: paymentData.tickets.length,
                    quantityForThisEvent: paymentData.totalQuantity,
                    amountForEvent: paymentData.totalForEvent,
                    uniqueUsers: paymentData.users.size,
                    isPartial: paymentData.isPartial,
                    existingRefunds: paymentData.existingRefunds.length
                });

                const paymentInfo = await this.getPaymentInfo(paymentId);
                if (!paymentInfo.success) {
                    throw new Error(`Не удалось получить информацию о платеже ${paymentId}`);
                }

                paymentData.totalPayment = paymentInfo.amount;
                paymentData.hasCart = paymentInfo.hasCart;
            }

            const results = [];
            let totalRefunded = 0;
            let ticketsRefunded = 0;
            let usersRefunded = 0;

            for (const paymentId of Object.keys(paymentsMap)) {
                const paymentData = paymentsMap[paymentId];
                
                try {
                    const refundPossible = await this.isRefundPossible(paymentId);
                    if (!refundPossible.possible) {
                        throw new Error(refundPossible.reason);
                    }

                    console.log(`Инициируем возврат для платежа ${paymentId}:`, {
                        amount: paymentData.totalForEvent,
                        isPartial: paymentData.isPartial,
                        quantity: paymentData.totalQuantity,
                        users: paymentData.users.size,
                        hasCart: paymentData.hasCart
                    });

                    const refundResult = await this.processRefundForEvent({
                        paymentId,
                        amount: paymentData.totalForEvent,
                        isPartial: paymentData.isPartial,
                        eventId
                    });

                    if (refundResult.success) {
                        await UserTicket.update({
                            payment_status: 'canceled',
                            refund_amount: Sequelize.literal(`"ticket"."price" * "order_item"."quantity"`),
                            refund_date: new Date()
                        }, {
                            where: {
                                id: {
                                    [Op.in]: paymentData.tickets.map(t => t.id)
                                }
                            },
                            include: [{
                                model: OrderItem,
                                as: 'order_item',
                                required: true
                            }],
                            transaction
                        });

                        totalRefunded += paymentData.totalForEvent;
                        ticketsRefunded += paymentData.totalQuantity;
                        usersRefunded += paymentData.users.size;

                        results.push({
                            ...refundResult,
                            paymentId,
                            refundAmount: paymentData.totalForEvent,
                            ticketsCount: paymentData.totalQuantity,
                            usersCount: paymentData.users.size,
                            isPartial: paymentData.isPartial
                        });
                    } else {
                        results.push({
                            success: false,
                            error: refundResult.error,
                            paymentId,
                            refundAmount: paymentData.totalForEvent,
                            ticketsCount: paymentData.totalQuantity
                        });
                    }
                } catch (error) {
                    console.error(`Ошибка возврата для платежа ${paymentId}:`, {
                        error: error.message,
                        stack: error.stack
                    });
                    results.push({
                        success: false,
                        error: error.message,
                        paymentId,
                        refundAmount: paymentData.totalForEvent,
                        ticketsCount: paymentData.totalQuantity
                    });
                }
            }

            await transaction.commit();
            
            console.log('Итоги возврата:', {
                event: event.title,
                totalRefunded,
                ticketsRefunded,
                usersRefunded,
                results
            });

            return {
                success: results.some(r => r.success),
                eventTitle: event.title,
                refundedPayments: results.filter(r => r.success).length,
                refundedUsers: usersRefunded,
                refundedTickets: ticketsRefunded,
                totalAmount: totalRefunded.toFixed(2),
                details: results
            };

        } catch (error) {
            await transaction.rollback();
            console.error('Ошибка возврата билетов:', {
                error: error.message,
                stack: error.stack
            });
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default RefundService;