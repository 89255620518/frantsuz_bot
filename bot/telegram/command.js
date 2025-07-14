export const setupCommands = (bot) => {
    bot.setMyCommands([
        { command: '/start', description: 'Начать работу с ботом' },
        { command: '/tickets', description: 'Купить билеты' },
        { command: '/menu', description: 'Меню бара и кухни' },
        { command: '/billiard', description: 'Бильярд' },
        { command: '/karaoke', description: 'Караоке' },
        { command: '/disco', description: 'Диско-бар' },
        { command: '/lounge', description: 'Лаунж зона' },
        { command: '/playstation', description: 'Игровые приставки' },
        { command: '/games', description: 'Настольные игры' },
        { command: '/events', description: 'Афиша мероприятий' },
        { command: '/reserve', description: 'Бронирование' },
        { command: '/contacts', description: 'Контакты' }
    ]).then(() => console.log('Командное меню установлено'))
        .catch(console.error);
};