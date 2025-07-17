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
    }

    // Генерация номера билета в формате Frantsuz-XXXXXXX (до 7 цифр)
    static generateTicketNumber() {
        const randomNumbers = Math.floor(Math.random() * 10000000)
            .toString()
            .padStart(7, '0');
        return `Frantsuz-${randomNumbers}`;
    }

    // Генерация QR-кода
    static async generateQRCode(ticketNumber) {
        try {
            const qrCodeDataURL = await QRCode.toDataURL(ticketNumber, {
                width: 200,
                margin: 1,
                color: { dark: '#000', light: '#fff' }
            });
            return qrCodeDataURL;
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
                }
            },
            indexes: [
                { fields: ['user_id'], name: 'user_tickets_user_id_idx' },
                { fields: ['ticket_id'], name: 'user_tickets_ticket_id_idx' },
                { fields: ['ticket_number'], unique: true, name: 'user_tickets_ticket_number_unique' },
                { fields: ['user_id', 'ticket_id'], name: 'user_tickets_composite_idx' }
            ]
        }
    );

    return UserTicket;
};

export { UserTicket, initUserTicket };