import { Order } from '../models/Orders.js';
import { OrderItem } from '../models/OrderItem.js';

class OrderService {
    static async createOrder(user, tickets, paymentData) {
        const transaction = await Order.sequelize.transaction();

        try {
            // Создаем заказ
            const order = await Order.create({
                user_id: user.telegram_id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                status: 'paid',
                total_amount: tickets.reduce((sum, t) => sum + (t.price * t.quantity), 0),
                payment_id: paymentData.id,
                payment_method: paymentData.method
            }, { transaction });

            // Создаем элементы заказа
            await Promise.all(tickets.map(ticket =>
                OrderItem.create({
                    order_id: order.id,
                    user_ticket_id: ticket.id,
                    price: ticket.price,
                    quantity: ticket.quantity
                }, { transaction })
            ));

            await transaction.commit();
            return order;
        } catch (error) {
            await transaction.rollback();
            console.error('Ошибка при создании заказа:', error);
            throw new Error('Не удалось создать заказ');
        }
    }

    static async getOrderById(id) {
        try {
            return await Order.findByPk(id, {
                include: [
                    {
                        model: OrderItem,
                        as: 'items',
                        include: ['ticket']
                    },
                    'user'
                ]
            });
        } catch (error) {
            console.error('Ошибка при получении заказа:', error);
            throw new Error('Не удалось получить заказ');
        }
    }

    static async getUserOrders(userId) {
        try {
            return await Order.findAll({
                where: { user_id: userId },
                include: [
                    {
                        model: OrderItem,
                        as: 'items',
                        include: ['ticket']
                    }
                ],
                order: [['created_at', 'DESC']]
            });
        } catch (error) {
            console.error('Ошибка при получении заказов пользователя:', error);
            throw new Error('Не удалось получить заказы');
        }
    }
}

export default OrderService;