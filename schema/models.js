const Sequelize = require('sequelize');
const dbInstance = require('./db.js');

const models = {
    User: dbInstance.define('user', {
        discord: {
            type: Sequelize.TEXT,
            unique: true,
            allowNull: false,
        },
        steam: {
            type: Sequelize.TEXT,
            // unique: true, // might be bad idea to enforce this (others might steal steam_id without verification)
            allowNull: true,
        },
        rank: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        // unused, future proofing database
        score: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        games_played: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
        steamLinkToken: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        validated: {
            type: Sequelize.BOOLEAN,
            allowNull: true,
        }
    }),

    VerifiedSteam: dbInstance.define(
        'verifiedSteam', {
            steam: {
                type: Sequelize.TEXT,
                unique: true,
                allowNull: false,
            },
            banned: {
                type: Sequelize.BOOLEAN,
                allowNull: true,
            },
            banReason: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            bannedBy: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            bannedAt: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            unbannedAt: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            unbannedBy: {
                type: Sequelize.TEXT,
                allowNull: true,
            }
        }
    ),

    Tournament: dbInstance.define('tournament', {
        name: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        minRank: {
            type: Sequelize.INTEGER,
            allowNull: false
        }
    }),

    Registration: dbInstance.define('registration', {
        steam: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        steamName: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        region: {
            type: Sequelize.TEXT,
            allowNull: false
        }
    }),

};

// Define foreign keys here BEFORE syncing all models

models.Tournament.hasMany(models.Registration);
models.Registration.belongsTo(models.Tournament);
models.Registration.belongsTo(models.User);

models.User.hasMany(models.VerifiedSteam);
models.VerifiedSteam.belongsTo(models.User);

Object.values(models).forEach(model => model.sync());

module.exports = models;
