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
        },
        // last_played: {
        //
        // }
        // preferredregions: {
        //
        // }
    }),

    Tournament: dbInstance.define('tournament', {
        name: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        description: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        signupstartdatetime: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        signupenddatetime: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        // unused, future proofing database
        tournamentstartdatetime: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        tournamentenddatetime: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        tournamentsettings: { // free form json settings
            type: Sequelize.TEXT,
            allowNull: true,
        },
    }),

    TournamentRegistration: dbInstance.define('tournamentRegistration', {
        discord: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        steam: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        rank: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        score: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        date: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        region: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        country: {
            type: Sequelize.TEXT,
            allowNull: false,
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
};

// Define foreign keys here BEFORE syncing all models

models.Tournament.hasMany(models.TournamentRegistration, {foreignKey: 'fk_tournament'});
models.TournamentRegistration.belongsTo(models.Tournament, {foreignKey: 'fk_tournament'});

models.User.hasMany(models.VerifiedSteam);
models.VerifiedSteam.belongsTo(models.User);

Object.values(models).forEach(model => model.sync());

module.exports = models;
