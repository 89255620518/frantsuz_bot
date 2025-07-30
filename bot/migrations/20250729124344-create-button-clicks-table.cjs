'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('button_clicks', {
      button_id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Добавляем индексы
    await queryInterface.addIndex('button_clicks', ['count']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('button_clicks');
  }
};