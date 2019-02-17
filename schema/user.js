const Op = require('sequelize').Op;
const User = require('./models.js').User;

const userUtil = {
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

    findOneByVerifiedSteam: function (steam) {
        return User.findOne({
            where: {steam: steam, validated: true}
        });
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
