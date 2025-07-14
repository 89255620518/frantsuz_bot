import { Model, DataTypes } from "sequelize";

class User extends Model {
    static async findOrCreateFromTelegram(telegramUser) {
        if (!telegramUser?.id) {
            throw new Error('Invalid Telegram user data: missing id');
        }

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
                transaction: await this.sequelize.transaction()
            });

            return { user, created };
        } catch (error) {
            console.error('Error in findOrCreateFromTelegram:', error);
            throw new Error('Failed to create or find user');
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