const Op = require('sequelize').Op;
const User = require('./models.js').User;
const VerifiedSteam = require('./models.js').VerifiedSteam;


const userUtil = {
    findById: User.findByPk.bind(User),

    findByDiscord: function (discord) {
        return User.findOne({
            where: {discord: discord}
        });
    },

    // Steam is not unique, use findAllBySteam() to get all ids having the provided steam.
    findOneBySteam: function (steam) {
        return User.findOne({
            where: {steam: steam}
        });
    },

    findUserAndVerifiedSteamsByDiscord: function (discord) {
        return User.findOne({
            where: {discord: discord},
            include: [VerifiedSteam]
        });
    },

    // Create or update the user with active verified steam, and insert a verifiedSteam record associated with the user id.
    // Should only be called when the steam id doesn't exist in verifiedSteam.
    // todo: better done in one transaction, but the chance of race condition here is really slim.
    upsertUserWithVerifiedSteam: function (discord, steam) {
        return this.findByDiscord(discord).then(
            user => {
                if (user === null) {
                    return User.create({
                        discord: discord,
                        steam: steam,
                        validated: true
                    })
                } else {
                    return user.update({
                        steam: steam,
                        validated: true
                    })
                }
            }
        ).then( user =>
            VerifiedSteam.create({steam: steam}).then(verifiedSteam =>
                user.addVerifiedSteam(verifiedSteam)
            ));
    },

    findAllBySteam: function (steam) {
        return User.findAll({
            where: {steam: steam}
        });
    },

    findAllUsersWithSteamIdsIn: function (steams) {
        let wheres = [];
        steams.forEach(steam => {
            wheres.push({steam: steam});
        });
        return User.findAll({where: {[Op.or]: wheres}});
    },

    create: function (userObj) {
        return User.create(userObj);
    },

    getVerificationStats: function () {
        return User.count({where: {validated: true}});
    }
};

module.exports = userUtil;
