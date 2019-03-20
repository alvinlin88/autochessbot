const Tournament = require('./models.js').Tournament;
const Registration = require('./models.js').Registration;

const tournamentUtil = {
    createTournament: function (name, rank) {
        return Tournament.create({
            name: name,
            minRank: rank
        });
    },

    latest: function () {
        return Tournament.findOne({
            order: [['createdAt', 'DESC']]
        });
    },

    createRegistration: function (steam, region) {
        return Registration.create({
            steam: steam,
            region: region
        });
    },
};

module.exports = tournamentUtil;
