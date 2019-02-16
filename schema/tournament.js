const Sequelize = require('sequelize');
const dbInstance = require('./db.js');
const Op = Sequelize.Op;

const Tournament = dbInstance.define('tournament', {
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
});

Tournament.sync();

const TournamentRegistration = dbInstance.define('tournamentRegistration', {
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
});

TournamentRegistration.belongsTo(Tournament, {foreignKey: 'fk_tournament'});

Tournament.sync();
TournamentRegistration.sync();

const tournamentUtil = {
    createTournament: function (tournamentObj) {
        return Tournament.create(tournamentObj);
    },

    getTournament: function (tournamentID) {
        return Tournament.findOne({
            where: {id: tournamentID}
        });
    },

    findRegistration: function (where) {
        return TournamentRegistration.findOne({
            where: where,
        });
    },

    createRegistration: function (tournamentRegistrationObj) {
        return TournamentRegistration.create(tournamentRegistrationObj);
    }
};

module.exports = tournamentUtil;
