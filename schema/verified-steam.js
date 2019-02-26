const User = require('./models.js').User;
const VerifiedSteam = require('./models.js').VerifiedSteam;

const verifiedSteamUtil = {
    findOneBySteam: function (steam) {
        return VerifiedSteam.findOne({where: {steam: steam}});
    },

    banSteam: function (steam, reason, bannedBy) {
        return this.findOneBySteam(steam).then(verifiedSteam => {
            if (verifiedSteam === null) {
                return VerifiedSteam.create({
                    banned: true,
                    steam: steam,
                    banReason: reason,
                    bannedBy: bannedBy,
                    bannedAt: Date.now()
                });
            } else {
                return verifiedSteam.update({
                    banned: true,
                    banReason: reason,
                    bannedBy: bannedBy,
                    bannedAt: Date.now()
                });
            }
        });
    },

    unbanSteam: function (steam, unbannedBy) {
        return this.findOneBySteam(steam).then(verifiedSteam => {
            if (verifiedSteam === null || verifiedSteam.banned !== true) {
                return null;
            } else {
                return verifiedSteam.update({
                    banned: false,
                    unbannedBy: unbannedBy,
                    unbannedAt: Date.now()
                });
            }
        });
    }
};

module.exports = verifiedSteamUtil;