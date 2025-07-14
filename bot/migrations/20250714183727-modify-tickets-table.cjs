'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Изменяем только user_id, разрешая NULL значения
    await queryInterface.changeColumn('tickets', 'user_id', {
      type: Sequelize.BIGINT,
      allowNull: true, // Теперь разрешаем NULL
      references: {
        model: 'users',
        key: 'telegram_id'
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Возвращаем обратно allowNull: false при откате
    await queryInterface.changeColumn('tickets', 'user_id', {
      type: Sequelize.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'telegram_id'
      }
    });
  }
};