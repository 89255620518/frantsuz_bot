import { Model, DataTypes } from "sequelize";
import QRCode from 'qrcode';

class UserTicket extends Model {
    static associate(models) {
        this.belongsTo(models.User, {
            foreignKey: 'user_id',
            targetKey: 'telegram_id',
            as: 'user'
        });
        this.belongsTo(models.Ticket, {
            foreignKey: 'ticket_id',
            as: 'ticket'
        });
        this.hasOne(models.OrderItem, {
            foreignKey: 'user_ticket_id',
            as: 'order_item'
        });
    }

    static generateTicketNumber() {
        const randomNumbers = Math.floor(Math.random() * 10000000)
            .toString()
            .padStart(7, '0');
        return `Француз-${randomNumbers}`;
    }

    static async generateQRCode(ticketNumber) {
        try {
            return await QRCode.toDataURL(ticketNumber, {
                width: 200,
                margin: 1,
                color: { dark: '#000', light: '#fff' }
            });
        } catch (err) {
            console.error('Ошибка генерации QR-кода:', err);
            return null;
        }
    }
}

const initUserTicket = (sequelize) => {
    UserTicket.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            user_id: { 
                type: DataTypes.BIGINT,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'telegram_id'
                },
            },
            ticket_id: { 
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'tickets',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            ticket_number: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
                defaultValue: () => UserTicket.generateTicketNumber()
            },
            qr_code: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            purchase_date: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW
            },
            is_used: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            used_at: {
                type: DataTypes.DATE,
                allowNull: true
            },
            payment_status: {
                type: DataTypes.ENUM('pending', 'paid', 'failed', 'canceled'),
                defaultValue: 'pending'
            },
            payment_id: {
                type: DataTypes.STRING,
                allowNull: true
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: true
            }
        },
        {
            sequelize,
            modelName: "UserTicket",
            tableName: "user_tickets",
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            underscored: true,
            hooks: {
                beforeCreate: async (userTicket) => {
                    if (!userTicket.ticket_number) {
                        userTicket.ticket_number = UserTicket.generateTicketNumber();
                    }
                    if (!userTicket.qr_code) {
                        userTicket.qr_code = await UserTicket.generateQRCode(userTicket.ticket_number);
                    }
                    if (userTicket.payment_status === 'pending' && !userTicket.expires_at) {
                        userTicket.expires_at = new Date(Date.now() + 30 * 60 * 1000); // 30 минут
                    }
                }
            },
            indexes: [
                { fields: ['user_id'] },
                { fields: ['ticket_id'] },
                { fields: ['ticket_number'], unique: true },
                { fields: ['payment_id'] },
                { fields: ['expires_at'] }
            ]
        }
    );

    return UserTicket;
};

export { UserTicket, initUserTicket };