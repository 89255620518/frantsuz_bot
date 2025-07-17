'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Сначала проверяем и добавляем PRIMARY KEY если его нет
    const [results] = await queryInterface.sequelize.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'tickets' 
      AND constraint_type = 'PRIMARY KEY'
    `);
    
    if (results.length === 0) {
      await queryInterface.sequelize.query(`
        ALTER TABLE tickets ADD PRIMARY KEY (id)
      `);
      console.log('Added PRIMARY KEY to tickets.id');
    }

    // 2. Создаем таблицу user_tickets с правильными связями
    await queryInterface.createTable('user_tickets', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'telegram_id'
        },
        onDelete: 'CASCADE'
      },
      ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tickets',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      ticket_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      qr_code: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      purchase_date: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      is_used: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      used_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // 3. Добавляем индексы
    await queryInterface.addIndex('user_tickets', ['user_id'], {
      name: 'user_tickets_user_id_idx'
    });
    
    await queryInterface.addIndex('user_tickets', ['ticket_id'], {
      name: 'user_tickets_ticket_id_idx'
    });
    
    await queryInterface.addIndex('user_tickets', ['user_id', 'ticket_id'], {
      name: 'user_tickets_composite_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    // Удаляем таблицу (автоматически удалит все связанные индексы и ограничения)
    await queryInterface.dropTable('user_tickets');
    
    // Опционально: удалить PRIMARY KEY если мы его добавляли
    // Но лучше оставить, так как это правильная структура
  }
};