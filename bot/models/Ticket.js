import { Model, DataTypes } from "sequelize";

class Ticket extends Model {
    static associate(models) {
        // Связь с пользователем (владелец билета)
        this.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    }
}

const initTicket = (sequelize) => {
    Ticket.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            title: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            image_url: {
                type: DataTypes.STRING,
                allowNull: true,
                validate: {
                    isUrl: true
                },
            },
            event_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            event_location: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            price: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
            is_used: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            qr_code: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            ticket_number: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
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
            indexes: [
                {
                    fields: ['user_id'],
                    name: 'tickets_user_id_idx'
                },
                {
                    fields: ['ticket_number'],
                    unique: true,
                    name: 'tickets_ticket_number_unique'
                }
            ]
        }
    );

    return Ticket;
};

export { Ticket, initTicket };