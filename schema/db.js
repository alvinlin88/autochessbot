const Sequelize = require('sequelize');
const logger = require('../logger.js');
const config = require("../config");

const metrics = require("../metrics");

const dbInstance = new Sequelize('autochess', 'postgres', 'postgres', {
    host: 'localhost',
    dialect: 'sqlite',

    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },

    logging: function (text, benchmark) {
        logger.info(text);
        let split = text.split(/ +/g);
        if (split[0] === "Executed") {
            metrics.sequelizeSummary.observe({'type': split[2].trim()}, benchmark);
        }
    },
    benchmark: true,

    // http://docs.sequelizejs.com/manual/tutorial/querying.html#operators
    operatorsAliases: false,

    // SQLite only
    storage: config.sqlitedb
});

module.exports = dbInstance;
