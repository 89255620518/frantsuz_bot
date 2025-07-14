import User from '../models/User.js';

export class UserService {
    static async findOrCreateUser(telegramUser) {
        try {
            const [user, created] = await User.findOrCreate({
                where: { telegram_id: telegramUser.id },
                defaults: {
                    username: telegramUser.username || null,
                    first_name: telegramUser.first_name || 'Гость',
                    last_name: telegramUser.last_name || null,
                    is_admin: false,
                    language_code: telegramUser.language_code || null,
                    is_bot: telegramUser.is_bot || false
                }
            });
            
            // Обновляем данные, если пользователь уже существовал
            if (!created) {
                await user.update({
                    username: telegramUser.username || user.username,
                    first_name: telegramUser.first_name || user.first_name,
                    last_name: telegramUser.last_name || user.last_name
                });
            }
            
            return { user, created };
        } catch (error) {
            console.error('Error in UserService.findOrCreateUser:', error);
            throw error;
        }
    }
}