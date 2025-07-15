'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Удаляем колонку user_id и внешний ключ
    await queryInterface.removeConstraint('tickets', 'tickets_user_id_fkey'); // для PostgreSQL
    await queryInterface.removeColumn('tickets', 'user_id');
  },

  async down(queryInterface, Sequelize) {
    // Восстанавливаем колонку (allowNull: true для обратной совместимости)
    await queryInterface.addColumn('tickets', 'user_id', {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: {
        model: 'users',
        key: 'telegram_id'
      }
    });
  }
};