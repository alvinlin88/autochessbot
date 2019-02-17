const Tournament = require('./models.js').Tournament;
const TournamentRegistration = require('./models.js').TournamentRegistration;

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
