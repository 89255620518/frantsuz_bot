import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class FileService {
    constructor() {
        this.mediaPath = path.resolve(__dirname, 'media');
        this.baseUrl = process.env.BASE_URL || 'http://localhost:3000/media';
    }

    async init() {
        await fs.ensureDir(this.mediaPath);
    }

    async saveTelegramPhoto(fileId, bot) {
        try {
            // 1. Получаем файл из Telegram
            const file = await bot.getFile(fileId);
            const telegramFileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`;

            // 2. Генерируем уникальное имя файла
            const ext = path.extname(file.file_path) || '.jpg';
            const fileName = `event_${Date.now()}${ext}`;
            const filePath = path.join(this.mediaPath, fileName);

            // 3. Скачиваем и сохраняем файл
            const response = await axios({
                method: 'GET',
                url: telegramFileUrl,
                responseType: 'stream'
            });

            await new Promise((resolve, reject) => {
                response.data.pipe(fs.createWriteStream(filePath))
                    .on('finish', resolve)
                    .on('error', reject);
            });

            // 4. Возвращаем URL для доступа к файлу
            return {
                url: `${this.baseUrl}/${fileName}`,
                fileName
            };
        } catch (error) {
            console.error('Ошибка сохранения фото:', error);
            throw error;
        }
    }
}

const fileService = new FileService();
export default fileService;