const Tournament = require('./models.js').Tournament;
const TournamentRegistration = require('./models.js').TournamentRegistration;

const tournamentUtil = {
    createTournament: function (name, rank) {
        return Tournament.create({
            name: name,
            minRank: rank
        });
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
    },

    findAllTopRegistrations: function (limit) {
        return TournamentRegistration.findAll({
            order: [
                ['score', 'DESC'],
                ['date', 'DESC'],
            ],
            limit: limit,
        });
    }
};

module.exports = tournamentUtil;
