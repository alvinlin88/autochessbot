const Sequelize = require("sequelize")
const dbInstance = require("./db.js")
const Op = Sequelize.Op

const User = dbInstance.define("user", {
  discord: {
    type: Sequelize.TEXT,
    unique: true,
    allowNull: false
  },
  steam: {
    type: Sequelize.TEXT,
    // unique: true, // might be bad idea to enforce this (others might steal steam_id without verification)
    allowNull: true
  },
  rank: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  // unused, future proofing database
  score: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  games_played: {
    type: Sequelize.INTEGER,
    allowNull: true
  },
  steamLinkToken: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  validated: {
    type: Sequelize.BOOLEAN,
    allowNull: true
  }
  // last_played: {
  //
  // }
  // preferredregions: {
  //
  // }
})

User.sync()

const userUtil = {
  findByDiscord: function(discord) {
    return User.findOne({
      where: { discord: discord }
    })
  },

  // Steam is not unique, use findAllBySteam() to get all ids having the provided steam.
  findOneBySteam: function(steam) {
    return User.findOne({
      where: { steam: steam }
    })
  },

  findAllBySteam: function(steam) {
    return User.findAll({
      where: { steam: steam }
    })
  },

  findAllUsersWithSteamIdsIn: function(steams) {
    let wheres = []
    steams.forEach(steam => {
      wheres.push({ steam: steam })
    })
    return User.findAll({ where: { [Op.or]: wheres } })
  },

  create: function(userObj) {
    return User.create(userObj)
  },

  getVerificationStats: function() {
    return User.count({ where: { validated: true } })
  }
}

module.exports = userUtil
