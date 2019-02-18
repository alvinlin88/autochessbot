const User = require('./models.js').User;
const VerifiedSteam = require('./models.js').VerifiedSteam;

const verifiedSteamUtil = {
    findOneBySteam: function (steam) {
        return VerifiedSteam.findOne({where: {steam: steam}});
    }
};

module.exports = verifiedSteamUtil;