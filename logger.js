const winston = require("winston");
const config = require("./config");

const logger = winston.createLogger({
    level: 'error',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: config.logfile_error, level: 'error' }),
        new winston.transports.File({ filename: config.logfile })
    ]
});

module.exports = logger;
