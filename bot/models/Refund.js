import { DataTypes, Model } from "sequelize";

class Refund extends Model {
    static associate(models) {
        // Связь с пользователем
        this.belongsTo(models.User, {
            foreignKey: 'user_id',
            targetKey: 'telegram_id',
            as: 'user'
        });

        // Дополнительная связь для удобства
        this.hasMany(models.RefundTicket, {
            foreignKey: 'refund_id',
            as: 'refund_tickets'
        });

        this.belongsToMany(models.UserTicket, {
            through: models.RefundTicket,
            foreignKey: 'refund_id',
            otherKey: 'user_ticket_id',
            as: 'tickets',
            onDelete: 'CASCADE'
        });
    }
}

const initRefund = (sequelize) => {
    Refund.init(
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
                comment: 'ID пользователя в Telegram'
            },
            email: {
                type: DataTypes.STRING(100),
                allowNull: false,
                validate: {
                    isEmail: true
                },
                comment: 'Email для связи'
            },
            phone: {
                type: DataTypes.STRING(20),
                allowNull: false,
                validate: {
                    is: /^(\+7|8)[0-9]{10}$/
                },
                comment: 'Телефон для связи'
            },
            full_name: {
                type: DataTypes.STRING(150),
                allowNull: false,
                comment: 'ФИО получателя средств'
            },
            account_number: {
                type: DataTypes.STRING(50),
                allowNull: false,
                comment: 'Номер счета получателя'
            },
            bank_name: {
                type: DataTypes.STRING(100),
                allowNull: false,
                comment: 'Наименование банка'
            },
            bik: {
                type: DataTypes.STRING(20),
                allowNull: false,
                comment: 'БИК банка'
            },
            correspondent_account: {
                type: DataTypes.STRING(50),
                allowNull: false,
                comment: 'Корреспондентский счет'
            },
            inn: {
                type: DataTypes.STRING(20),
                allowNull: false,
                comment: 'ИНН получателя'
            },
            kpp: {
                type: DataTypes.STRING(20),
                allowNull: true,
                comment: 'КПП (если есть)'
            },
            okpo: {
                type: DataTypes.STRING(20),
                allowNull: true,
                comment: 'ОКПО (если есть)'
            },
            ogrn: {
                type: DataTypes.STRING(20),
                allowNull: true,
                comment: 'ОГРН (если есть)'
            },
            refund_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: 'Сумма к возврату'
            },
            refund_reason: {
                type: DataTypes.TEXT,
                allowNull: false,
                comment: 'Причина возврата'
            },
        },
        {
            sequelize,
            modelName: "Refund",
            tableName: "refunds",
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            underscored: true,
            paranoid: true, // Для мягкого удаления
            indexes: [
                { fields: ['user_id'] },
                { fields: ['created_at'] }
            ]
        }
    );

    return Refund;
};

// Модель для связи возвратов и билетов
class RefundTicket extends Model {
    static associate(models) {
        this.belongsTo(models.Refund, {
            foreignKey: 'refund_id',
            as: 'refund'
        });
        
        this.belongsTo(models.UserTicket, {
            foreignKey: 'user_ticket_id',
            as: 'ticket'
        });
    }
}

const initRefundTicket = (sequelize) => {
    RefundTicket.init(
        {
            refund_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                references: {
                    model: 'refunds',
                    key: 'id'
                }
            },
            user_ticket_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                references: {
                    model: 'user_tickets',
                    key: 'id'
                }
            },
            ticket_number: {
                type: DataTypes.STRING(50),
                allowNull: false,
                comment: 'Номер билета (дублируем для удобства)'
            },
            refund_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: 'Сумма возврата по этому билету'
            }
        },
        {
            sequelize,
            modelName: "RefundTicket",
            tableName: "refund_tickets",
            timestamps: false,
            underscored: true
        }
    );

    return RefundTicket;
};

export { Refund, initRefund, RefundTicket, initRefundTicket };