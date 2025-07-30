import { ButtonClick } from '../models/ButtonClick.js';

class ButtonTrackingService {
    async trackButtonClick(buttonId) {
        try {
            // Используем правильный метод incrementClick, который вы определили в модели
            const result = await ButtonClick.incrementClick(buttonId);
            console.log(`Кнопка ${buttonId} зарегистрирована`);
            return {
                success: true,
                count: result.count,
                buttonId: result.button_id
            };
        } catch (error) {
            console.error(`Ошибка при регистрации кнопки ${buttonId}:`, error);
            throw error;
        }
    }

    async getButtonStats(buttonId) {
        try {
            const stats = await ButtonClick.findOne({
                where: { button_id: buttonId },
                attributes: ['count', 'updated_at']
            });

            return stats ? {
                count: stats.count,
                lastClick: stats.updated_at
            } : null;
        } catch (error) {
            console.error(`Ошибка при получении статистики для кнопки ${buttonId}:`, error);
            throw error;
        }
    }

    async getTopButtons(limit = 10) {
        try {
            const topButtons = await ButtonClick.findAll({
                attributes: ['button_id', 'count'],
                order: [['count', 'DESC']],
                limit
            });

            return topButtons.map(button => ({
                buttonId: button.button_id,
                count: button.count
            }));
        } catch (error) {
            console.error('Ошибка при получении топа кнопок:', error);
            throw error;
        }
    }

    async getAllButtons() {
        try {
            const buttons = await ButtonClick.findAll({
                attributes: ['button_id', 'count'],
                order: [['count', 'DESC']]
            });

            return buttons.map(button => ({
                buttonId: button.button_id,
                count: button.count
            }));
        } catch (error) {
            console.error('Ошибка при получении всех кнопок:', error);
            throw error;
        }
    }

    async getFormattedStats(buttonId) {
        try {
            const stats = await this.getButtonStats(buttonId);

            if (!stats) {
                return `Кнопка "${buttonId}" еще не нажималась.`;
            }

            const lastClickDate = new Date(stats.lastClick);
            const formattedDate = lastClickDate.toLocaleString('ru-RU');

            return `📊 Статистика кнопки "${buttonId}":\n` +
                `🔢 Количество нажатий: ${stats.count}\n` +
                `⏱ Последнее нажатие: ${formattedDate}`;
        } catch (error) {
            console.error('Ошибка при форматировании статистики:', error);
            return 'Не удалось получить статистику';
        }
    }

    async getFormattedTopButtons(limit = 10) {
        try {
            const topButtons = await this.getTopButtons(limit);

            if (topButtons.length === 0) {
                return 'Нет данных о нажатиях кнопок.';
            }

            let message = '🏆 Топ самых популярных кнопок:\n\n';
            topButtons.forEach((button, index) => {
                message += `${index + 1}. ${button.buttonId} - ${button.count} нажатий\n`;
            });

            return message;
        } catch (error) {
            console.error('Ошибка при форматировании топа кнопок:', error);
            return 'Не удалось получить топ кнопок';
        }
    }
}

export { ButtonTrackingService };