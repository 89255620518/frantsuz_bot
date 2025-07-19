import { UserTicket } from '../models/UserTicket.js';
import QRCode from 'qrcode';
import { Op } from 'sequelize';

class TicketService {
    /**
     * Создает временный билет (до оплаты)
     */
    static async createPendingTicket(userId, ticketId) {
        try {
            // Сначала очистим старые просроченные билеты этого пользователя
            await UserTicket.destroy({
                where: {
                    user_id: userId,
                    payment_status: 'pending',
                    created_at: {
                        [Op.lt]: new Date(Date.now() - 5 * 60 * 1000)
                    }
                }
            });

            const ticket = await UserTicket.create({
                user_id: userId,
                ticket_id: ticketId,
                payment_status: 'pending',
                expires_at: new Date(Date.now() + 5 * 60 * 1000)
            });

            setTimeout(async () => {
                try {
                    const freshTicket = await UserTicket.findByPk(ticket.id);
                    if (freshTicket && freshTicket.payment_status === 'pending') {
                        await freshTicket.update({ payment_status: 'canceled' });
                        await freshTicket.destroy();
                        console.log(`Билет ${ticket.id} автоматически удален (не оплачен в течение 5 минут)`);
                    }
                } catch (error) {
                    console.error('Ошибка при автоматическом удалении билета:', error);
                }
            }, 5 * 60 * 1000);

            return ticket;
        } catch (error) {
            console.error('Ошибка при создании временного билета:', error);
            throw new Error('Не удалось создать временный билет');
        }
    }

    static async updatePaymentId(ticketId, paymentId) {
        try {
            const ticket = await UserTicket.findByPk(ticketId);
            if (!ticket) {
                throw new Error('Билет не найден');
            }

            await ticket.update({
                payment_id: paymentId
            });

            return ticket;
        } catch (error) {
            console.error('Ошибка при обновлении payment_id:', error);
            throw error;
        }
    }

    static async confirmPayment(paymentId) {
        try {
            const paymentIdStr = String(paymentId);

            const ticket = await UserTicket.findOne({
                where: { payment_id: paymentIdStr }
            });

            if (!ticket) {
                throw new Error('Билет не найден');
            }

            const updatedTicket = await ticket.update({
                payment_status: 'paid',
                expires_at: null,
                purchase_date: new Date()
            });

            return updatedTicket;
        } catch (error) {
            console.error('Ошибка при подтверждении оплаты:', error);
            throw error;
        }
    }

    /**
     * Отменяет просроченные pending билеты (старше 5 минут)
     */
    static async cancelExpiredPendingTickets() {
        try {
            const expirationTime = new Date(Date.now() - 5 * 60 * 1000);
            
            const [affectedCount] = await UserTicket.update(
                { payment_status: 'canceled' },
                {
                    where: {
                        payment_status: 'pending',
                        created_at: {
                            [Op.lt]: expirationTime
                        }
                    }
                }
            );

            console.log(`Отменено ${affectedCount} просроченных билетов`);
            return affectedCount;
        } catch (error) {
            console.error('Ошибка при отмене просроченных билетов:', error);
            throw error;
        }
    }

    /**
     * Удаляет все билеты со статусом 'canceled'
     */
    static async removeCanceledTickets() {
        try {
            const result = await UserTicket.destroy({
                where: {
                    payment_status: 'canceled'
                }
            });

            console.log(`Удалено ${result} билетов со статусом canceled`);
            return result;
        } catch (error) {
            console.error('Ошибка при удалении canceled билетов:', error);
            throw new Error('Не удалось удалить canceled билеты');
        }
    }

    /**
     * Автоматическая очистка билетов (отмена просроченных + удаление canceled)
     */
    static async performAutoCleanup() {
        try {
            const canceledCount = await this.cancelExpiredPendingTickets();
            const deletedCount = await this.removeCanceledTickets();
            
            return {
                canceled: canceledCount,
                deleted: deletedCount
            };
        } catch (error) {
            console.error('Ошибка при автоматической очистке билетов:', error);
            throw error;
        }
    }

    /**
     * Отменяет билет при неудачной оплате
     */
    static async cancelPendingTicket(ticketId) {
        try {
            const result = await UserTicket.destroy({
                where: {
                    id: ticketId,
                    payment_status: 'pending'
                }
            });

            return result > 0;
        } catch (error) {
            console.error('Ошибка при отмене билета:', error);
            throw error;
        }
    }

    /**
     * Очищает просроченные неоплаченные билеты
     */
    static async cleanupExpiredTickets() {
        try {
            const result = await UserTicket.destroy({
                where: {
                    payment_status: 'pending',
                    expires_at: {
                        [Op.lt]: new Date()
                    }
                }
            });

            return result;
        } catch (error) {
            console.error('Ошибка при очистке билетов:', error);
            throw error;
        }
    }

    /**
     * Получает билет по ID
     */
    static async getTicketById(ticketId) {
        try {
            return await UserTicket.findByPk(ticketId, {
                include: ['user', 'ticket']
            });
        } catch (error) {
            console.error('Ошибка при получении билета:', error);
            throw new Error('Не удалось получить билет');
        }
    }

    /**
     * Получает все билеты пользователя
     */
    static async getUserTickets(userId) {
        try {
            return await UserTicket.findAll({
                where: { user_id: userId },
                include: ['ticket'],
                order: [['created_at', 'DESC']]
            });
        } catch (error) {
            console.error('Ошибка при получении билетов пользователя:', error);
            throw new Error('Не удалось получить билеты пользователя');
        }
    }

    /**
     * Отмечает билет как использованный
     */
    static async markTicketAsUsed(ticketNumber) {
        try {
            const ticket = await UserTicket.findOne({
                where: { ticket_number: ticketNumber }
            });

            if (!ticket) {
                throw new Error('Билет не найден');
            }

            if (ticket.is_used) {
                throw new Error('Билет уже использован');
            }

            if (ticket.payment_status !== 'paid') {
                throw new Error('Билет не оплачен');
            }

            const updatedTicket = await ticket.update({
                is_used: true,
                used_at: new Date()
            });

            return updatedTicket;
        } catch (error) {
            console.error('Ошибка при отметке билета как использованного:', error);
            throw error;
        }
    }

    /**
     * Получает статистику по билетам
     */
    static async getTicketsStatistics() {
        try {
            const totalTickets = await UserTicket.count();
            const usedTickets = await UserTicket.count({
                where: {
                    is_used: true,
                    payment_status: 'paid'
                }
            });
            const activeTickets = await UserTicket.count({
                where: {
                    is_used: false,
                    payment_status: 'paid'
                }
            });
            const pendingTickets = await UserTicket.count({
                where: {
                    payment_status: 'pending'
                }
            });
            const canceledTickets = await UserTicket.count({
                where: {
                    payment_status: 'canceled'
                }
            });

            return {
                total: totalTickets,
                used: usedTickets,
                active: activeTickets,
                pending: pendingTickets,
                canceled: canceledTickets,
                usedPercentage: totalTickets > 0 ? Math.round((usedTickets / totalTickets) * 100) : 0
            };
        } catch (error) {
            console.error('Ошибка при получении статистики билетов:', error);
            throw new Error('Не удалось получить статистику');
        }
    }

    /**
     * Обновляет данные билета
     */
    static async updateTicket(ticketId, updateData) {
        try {
            const ticket = await UserTicket.findByPk(ticketId);

            if (!ticket) {
                throw new Error('Билет не найден');
            }

            const allowedFields = ['is_used', 'used_at', 'ticket_number', 'payment_status'];
            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key)) {
                    ticket[key] = updateData[key];
                }
            });

            if (updateData.ticket_number) {
                ticket.qr_code = await QRCode.toDataURL(updateData.ticket_number, {
                    width: 200,
                    margin: 1,
                    color: { dark: '#000', light: '#fff' }
                });
            }

            const updatedTicket = await ticket.save();
            return updatedTicket;
        } catch (error) {
            console.error('Ошибка при обновлении билета:', error);
            throw new Error('Не удалось обновить билет');
        }
    }

    static async deleteTicket(ticketId) {
        try {
            const result = await UserTicket.destroy({
                where: { id: ticketId }
            });

            if (result === 0) {
                throw new Error('Билет не найден');
            }

            return true;
        } catch (error) {
            console.error('Ошибка при удалении билета:', error);
            throw new Error('Не удалось удалить билет');
        }
    }

    static async deleteAllUserTickets(userId) {
        try {
            return await UserTicket.destroy({
                where: { user_id: userId }
            });
        } catch (error) {
            console.error('Ошибка при удалении билетов пользователя:', error);
            throw new Error('Не удалось удалить билеты пользователя');
        }
    }

    static async deleteAllEventTickets(eventId) {
        try {
            return await UserTicket.destroy({
                where: { ticket_id: eventId }
            });
        } catch (error) {
            console.error('Ошибка при удалении билетов мероприятия:', error);
            throw new Error('Не удалось удалить билеты мероприятия');
        }
    }

    static async deleteAllTickets() {
        try {
            return await UserTicket.destroy({
                where: {},
                truncate: true
            });
        } catch (error) {
            console.error('Ошибка при удалении всех билетов:', error);
            throw new Error('Не удалось удалить все билеты');
        }
    }

    /**
     * Получает количество билетов со статусом canceled
     */
    static async getCanceledTicketsCount() {
        try {
            return await UserTicket.count({
                where: { payment_status: 'canceled' }
            });
        } catch (error) {
            console.error('Ошибка при получении количества canceled билетов:', error);
            throw error;
        }
    }
}

export default TicketService;