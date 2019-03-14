const Sequelize = require('sequelize');
const logger = require('../logger.js');
const config = require("../config");
const dbInstance = new Sequelize('autochess', 'postgres', 'postgres', {
    host: 'localhost',
    dialect: 'sqlite',

    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },

    logging: logger.info,

    // http://docs.sequelizejs.com/manual/tutorial/querying.html#operators
    operatorsAliases: false,

    // SQLite only
    storage: config.sqlitedb
});

module.exports = dbInstance;
