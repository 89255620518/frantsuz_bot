'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 2. Добавляем новую колонку id с автоинкрементом
    await queryInterface.addColumn('tickets', 'id', {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    });
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