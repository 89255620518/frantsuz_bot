'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // 1. Удаляем таблицы в правильном порядке (сначала зависимые)
      const tables = await queryInterface.showAllTables({ transaction });
      
      if (tables.includes('order_items')) {
        await queryInterface.dropTable('order_items', { transaction });
      }
      
      if (tables.includes('orders')) {
        await queryInterface.dropTable('orders', { transaction });
      }

      // 2. Удаляем тип enum если существует
      const enumExists = await queryInterface.sequelize.query(
        `SELECT 1 FROM pg_type WHERE typname = 'enum_orders_status'`,
        { transaction, type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      
      if (enumExists.length > 0) {
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "enum_orders_status";',
          { transaction }
        );
      }

      // 3. Создаем новый тип enum
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_orders_status" AS ENUM ('pending', 'paid', 'completed', 'canceled')`,
        { transaction }
      );

      // 4. Создаем таблицу orders с новой структурой
      await queryInterface.createTable('orders', {
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
          }
        },
        first_name: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        last_name: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        email: {
          type: Sequelize.STRING(100),
          allowNull: false,
          validate: {
            isEmail: true
          }
        },
        phone: {
          type: Sequelize.STRING(20),
          allowNull: false,
          validate: {
            is: /^(\+7|8)[0-9]{10}$/
          }
        },
        status: {
          type: 'enum_orders_status',
          defaultValue: 'pending'
        },
        total_amount: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        payment_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        payment_method: {
          type: Sequelize.STRING(50),
          allowNull: true
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
      }, { transaction });

      // 5. Создаем таблицу order_items
      await queryInterface.createTable('order_items', {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        order_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'orders',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        user_ticket_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'user_tickets',
            key: 'id'
          },
          unique: true
        },
        price: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        quantity: {
          type: Sequelize.INTEGER,
          defaultValue: 1
        }
      }, { transaction });

      // 6. Добавляем индексы
      await queryInterface.addIndex('orders', ['user_id'], { transaction });
      await queryInterface.addIndex('orders', ['status'], { transaction });
      await queryInterface.addIndex('orders', ['payment_id'], { transaction });
      await queryInterface.addIndex('order_items', ['order_id'], { transaction });
      await queryInterface.addIndex('order_items', ['user_ticket_id'], { 
        unique: true,
        transaction 
      });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Удаляем таблицы в обратном порядке
      await queryInterface.dropTable('order_items', { transaction });
      await queryInterface.dropTable('orders', { transaction });
      
      // Удаляем тип enum
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_orders_status";',
        { transaction }
      );
    });
  }
};