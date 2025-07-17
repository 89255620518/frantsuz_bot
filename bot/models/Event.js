import { Model, DataTypes } from "sequelize";
import QRCode from 'qrcode';

class Ticket extends Model {
    static associate(models) {
        this.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
        
        this.hasMany(models.UserTicket, {
            foreignKey: 'ticket_id',
            as: 'user_tickets'
        });
    }

    // Генерация QR-кода и отправка в Telegram (без сохранения в файл)
    static async generateQRCode(ticketNumber) {
        try {
            // Генерируем QR-код в виде Data URL (base64)
            const qrCodeDataURL = await QRCode.toDataURL(ticketNumber, {
                width: 200,
                margin: 1,
                color: { dark: '#000', light: '#fff' }
            });
            return qrCodeDataURL; // Возвращаем base64
        } catch (err) {
            console.error('Ошибка генерации QR-кода:', err);
            return null;
        }
    }

    // Генерация номера билета
    static generateTicketNumber() {
        const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
        return `Frantsuz-${randomPart}`;
    }
}

const initTicket = (sequelize) => {
    Ticket.init(
        {
            id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
            title: { type: DataTypes.STRING(100), allowNull: false },
            description: { type: DataTypes.TEXT, allowNull: true },
            image_url: { type: DataTypes.STRING, allowNull: true },
            event_date: { type: DataTypes.DATE, allowNull: false },
            event_location: { type: DataTypes.STRING, allowNull: false },
            price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
            is_used: { type: DataTypes.BOOLEAN, defaultValue: false },
            qr_code: { type: DataTypes.TEXT, allowNull: true },
            ticket_number: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
                defaultValue: () => Ticket.generateTicketNumber()
            }
        },
        {
            sequelize,
            modelName: "Ticket",
            tableName: "tickets",
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            underscored: true,
            hooks: {
                beforeCreate: async (ticket) => {
                    if (!ticket.qr_code) {
                        ticket.qr_code = await Ticket.generateQRCode(ticket.ticket_number);
                    }
                }
            },
            indexes: [
                { fields: ['user_id'], name: 'tickets_user_id_idx' },
                { fields: ['ticket_number'], unique: true, name: 'tickets_ticket_number_unique' }
            ]
        }
    );

    return Ticket;
};

export { Ticket, initTicket };