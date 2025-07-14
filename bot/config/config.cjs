const { Sequelize } = require("sequelize");
const dotenv = require('dotenv');

dotenv.config();

const config = {
  development: {
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "Restart.1996",
    database: process.env.DB_NAME || "frantsuz-mini",
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
    migrationStorageTableName: 'sequelize_meta',
    define: {
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      timestampsWithTimezone: true,
    },
    seederStorage: "sequelize",
    seederStorageTableName: "sequelize_data"
  },
  test: {
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "Restart.1996",
    database: process.env.DB_NAME || "frantsuz-mini",
    host: process.env.DB_HOST || "localhost",
    dialect: "postgres",
    migrationStorageTableName: 'sequelize_meta',
    define: {
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      timestampsWithTimezone: true,
    }
  },
  production: {
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "Restart.1996",
    database: process.env.DB_NAME || "frantsuz-mini",
    host: process.env.DB_HOST || "localhost",
    dialect: "postgres",
    migrationStorageTableName: 'sequelize_meta',
    define: {
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      timestampsWithTimezone: true,
    }
  }
};

const env = process.env.NODE_ENV || "development";
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: dbConfig.dialect,
  define: dbConfig.define,
  migrationStorageTableName: dbConfig.migrationStorageTableName
});

module.exports = {
  development: dbConfig,
  test: config.test,
  production: config.production,
  sequelize
};
