'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tickets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'telegram_id'
        },
      },
      title: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      image_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      event_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      event_location: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      is_used: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      qr_code: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      ticket_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
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
    await queryInterface.addIndex('tickets', ['user_id'], {
      name: 'tickets_user_id_idx'
    });

    await queryInterface.addIndex('tickets', ['ticket_number'], {
      name: 'tickets_ticket_number_unique',
      unique: true
    });

    // Создаем триггер для автоматического обновления updated_at (только для PostgreSQL)
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER update_tickets_updated_at
      BEFORE UPDATE ON tickets
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
  },

  async down(queryInterface) {
    // Удаляем триггер сначала (для PostgreSQL)
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
      DROP FUNCTION IF EXISTS update_updated_at_column;
    `);
    
    // Удаляем таблицу
    await queryInterface.dropTable('tickets');
  }
};