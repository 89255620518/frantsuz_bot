// migrations/20240218000000-add-user-fields.cjs
'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'language_code', {
      type: DataTypes.STRING(10),
      allowNull: true
    });
    
    await queryInterface.addColumn('users', 'is_bot', {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    });
    
    await queryInterface.addColumn('users', 'phone', {
      type: DataTypes.STRING(20),
      allowNull: true
    });
    
    await queryInterface.addColumn('users', 'email', {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'language_code');
    await queryInterface.removeColumn('users', 'is_bot');
    await queryInterface.removeColumn('users', 'phone');
    await queryInterface.changeColumn('users', 'email', {
      type: DataTypes.STRING,
      allowNull: true
    });
  }
};