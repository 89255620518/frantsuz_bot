'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('refunds', {
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
        comment: 'ID пользователя в Telegram'
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Email для связи'
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Телефон для связи'
      },
      full_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
        comment: 'ФИО получателя средств'
      },
      account_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Номер счета получателя'
      },
      bank_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Наименование банка'
      },
      bik: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'БИК банка'
      },
      correspondent_account: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Корреспондентский счет'
      },
      inn: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'ИНН получателя'
      },
      kpp: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'КПП (если есть)'
      },
      okpo: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'ОКПО (если есть)'
      },
      ogrn: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'ОГРН (если есть)'
      },
      refund_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Сумма к возврату'
      },
      refund_reason: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Причина возврата'
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
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Добавляем индексы
    await queryInterface.addIndex('refunds', ['user_id']);
    await queryInterface.addIndex('refunds', ['created_at']);

    // Добавляем проверку для email
    await queryInterface.addConstraint('refunds', {
      fields: ['email'],
      type: 'check',
      where: {
        email: {
          [Sequelize.Op.regexp]: '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'
        }
      },
      name: 'refunds_email_check'
    });

    // Добавляем проверку для телефона
    await queryInterface.addConstraint('refunds', {
      fields: ['phone'],
      type: 'check',
      where: {
        phone: {
          [Sequelize.Op.regexp]: '^(\\+7|8)[0-9]{10}$'
        }
      },
      name: 'refunds_phone_check'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('refunds');
  }
};
