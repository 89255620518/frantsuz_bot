import { Model, DataTypes } from "sequelize";

class Order extends Model {
    static associate(models) {
        this.belongsTo(models.User, {
            foreignKey: 'user_id',
            targetKey: 'telegram_id',
            as: 'user'
        });
        
        this.hasMany(models.OrderItem, {
            foreignKey: 'order_id',
            as: 'items'
        });

    }
}

const initOrder = (sequelize) => {
    Order.init(
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
                }
            },
            first_name: {
                type: DataTypes.STRING(50),
                allowNull: false
            },
            last_name: {
                type: DataTypes.STRING(50),
                allowNull: false
            },
            email: {
                type: DataTypes.STRING(100),
                allowNull: false,
                validate: {
                    isEmail: true
                }
            },
            phone: {
                type: DataTypes.STRING(20),
                allowNull: false,
                validate: {
                    is: /^(\+7|8)[0-9]{10}$/
                }
            },
            status: {
                type: DataTypes.ENUM('pending', 'paid', 'completed', 'canceled'),
                defaultValue: 'pending'
            },
            total_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },
            payment_id: {
                type: DataTypes.STRING,
                allowNull: true
            },
            payment_method: {
                type: DataTypes.STRING(50),
                allowNull: true
            }
        },
        {
            sequelize,
            modelName: "Order",
            tableName: "orders",
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            underscored: true,
            indexes: [
                { fields: ['user_id'] },
                { fields: ['status'] },
                { fields: ['payment_id'] }
            ]
        }
    );

    return Order;
};

export { Order, initOrder };