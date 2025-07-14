'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,  // Исправлено: Sequelize.INTEGER вместо DataTypes.INTEGER
        primaryKey: true,
        autoIncrement: true
      },
      telegram_id: {
        type: Sequelize.BIGINT,  // Исправлено: Sequelize.BIGINT
        allowNull: false,
        unique: true
      },
      username: {
        type: Sequelize.STRING  // Исправлено: Sequelize.STRING
      },
      first_name: {
        type: Sequelize.STRING
      },
      last_name: {
        type: Sequelize.STRING
      },
      is_admin: {
        type: Sequelize.BOOLEAN,  // Исправлено: Sequelize.BOOLEAN
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,  // Исправлено: Sequelize.DATE
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('users', ['telegram_id'], {
      unique: true,
      name: 'users_telegram_id_unique'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  }
};