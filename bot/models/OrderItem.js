import { Model, DataTypes } from "sequelize";

class OrderItem extends Model {
    static associate(models) {
        this.belongsTo(models.Order, {
            foreignKey: 'order_id',
            as: 'order'
        });
        
        this.belongsTo(models.UserTicket, {
            foreignKey: 'user_ticket_id',
            as: 'ticket'
        });
    }
}

const initOrderItem = (sequelize) => {
    OrderItem.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            order_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'orders',
                    key: 'id'
                }
            },
            user_ticket_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'user_tickets',
                    key: 'id'
                },
                unique: true
            },
            price: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },
            quantity: {
                type: DataTypes.INTEGER,
                defaultValue: 1
            }
        },
        {
            sequelize,
            modelName: "OrderItem",
            tableName: "order_items",
            timestamps: false,
            underscored: true,
            indexes: [
                { fields: ['order_id'] },
                { fields: ['user_ticket_id'], unique: true }
            ]
        }
    );

    return OrderItem;
};

export { OrderItem, initOrderItem };