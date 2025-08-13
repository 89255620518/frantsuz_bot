'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('refund_tickets', {
      refund_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'refunds',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      user_ticket_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'user_tickets',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      ticket_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Номер билета (дублируем для удобства)'
      },
      refund_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Сумма возврата по этому билету'
      }
    });

    // Добавляем индексы для улучшения производительности
    await queryInterface.addIndex('refund_tickets', ['refund_id']);
    await queryInterface.addIndex('refund_tickets', ['user_ticket_id']);
    await queryInterface.addIndex('refund_tickets', ['ticket_number']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('refund_tickets');
  }
};
