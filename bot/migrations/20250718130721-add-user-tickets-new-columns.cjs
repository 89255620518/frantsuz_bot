'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Добавляем колонку payment_status
      await queryInterface.addColumn(
        'user_tickets',
        'payment_status',
        {
          type: Sequelize.ENUM('pending', 'paid', 'failed', 'canceled'),
          defaultValue: 'pending',
          allowNull: false
        },
        { transaction }
      );

      // Добавляем колонку payment_id
      await queryInterface.addColumn(
        'user_tickets',
        'payment_id',
        {
          type: Sequelize.STRING,
          allowNull: true
        },
        { transaction }
      );

      // Добавляем колонку expires_at
      await queryInterface.addColumn(
        'user_tickets',
        'expires_at',
        {
          type: Sequelize.DATE,
          allowNull: true
        },
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Удаляем колонки в обратном порядке
      await queryInterface.removeColumn('user_tickets', 'expires_at', { transaction });
      await queryInterface.removeColumn('user_tickets', 'payment_id', { transaction });
      
      // Удаляем ENUM тип после удаления колонки
      await queryInterface.removeColumn('user_tickets', 'payment_status', { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_user_tickets_payment_status";',
        { transaction }
      );
    });
  }
};