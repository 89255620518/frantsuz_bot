import { Model, DataTypes } from "sequelize";

class User extends Model {
    static associate(models) {
        this.hasMany(models.Ticket, {
            foreignKey: 'user_id',
            as: 'tickets'
        });
        
        this.hasMany(models.UserTicket, {
            foreignKey: 'user_id',
            targetKey: 'telegram_id',
            as: 'user_tickets'
        });
    }
    
    // models/User.js
    static async findOrCreateFromTelegram(telegramUser) {
        if (!telegramUser?.id) {
            throw new Error('Invalid Telegram user data: missing id');
        }

        const transaction = await this.sequelize.transaction();
        
        try {
            const [user, created] = await this.findOrCreate({
                where: { telegram_id: telegramUser.id },
                defaults: {
                    username: telegramUser.username || null,
                    first_name: telegramUser.first_name || 'Гость',
                    last_name: telegramUser.last_name || null,
                    is_admin: false,
                    language_code: telegramUser.language_code || null,
                    is_bot: telegramUser.is_bot || false
                },
                transaction
            });

            // Обновляем данные, если пользователь уже существовал
            if (!created) {
                await user.update({
                    username: telegramUser.username || user.username,
                    first_name: telegramUser.first_name || user.first_name,
                    last_name: telegramUser.last_name || user.last_name,
                    language_code: telegramUser.language_code || user.language_code
                }, { transaction });
            }

            await transaction.commit();
            return { user, created };
        } catch (error) {
            await transaction.rollback();
            console.error('Error in findOrCreateFromTelegram:', error);
            throw error;
        }
    }
}

// Функция инициализации модели
const initUser = (sequelize) => {
    User.init(
        {
            telegram_id: {
                type: DataTypes.BIGINT,
                allowNull: false,
                unique: true,
                primaryKey: true
            },
            username: {
                type: DataTypes.STRING,
                allowNull: true
            },
            first_name: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'Гость'
            },
            last_name: {
                type: DataTypes.STRING,
                allowNull: true
            },
            is_admin: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            language_code: {
                type: DataTypes.STRING(10),
                allowNull: true
            },
            is_bot: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            phone: {
                type: DataTypes.STRING(20),
                allowNull: true
            },
            email: {
                type: DataTypes.STRING,
                allowNull: true,
                validate: {
                    isEmail: true
                }
            }
        },
        {
            sequelize,
            modelName: "User",
            tableName: "users",
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            underscored: true
        }
    );

    return User;
};

export { User, initUser };