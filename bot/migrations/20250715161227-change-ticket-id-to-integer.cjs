'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {

    // 1. Удаляем старую колонку id (UUID)
    await queryInterface.removeColumn('tickets', 'id');
  },

  down: async (queryInterface, Sequelize) => {
    // Откат миграции
    await queryInterface.removeColumn('tickets', 'id');
    await queryInterface.addColumn('tickets', 'id', {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
      allowNull: false
    });
  }
};