const Sequelize = require('sequelize');
const dbInstance = require('./db.js');

const User = dbInstance.define('user', {
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
});

User.sync();

module.exports = User;