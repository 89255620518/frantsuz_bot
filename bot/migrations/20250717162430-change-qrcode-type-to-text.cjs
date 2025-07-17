'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('tickets', 'qr_code', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('tickets', 'qr_code', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};