const { VerifiedSteam } = require("../../schema/models")

const VerifiedSteamAPI = {
  findOneBySteam: function(steam) {
    return VerifiedSteam.findOne({ where: { steam: steam } })
  }
}

module.exports = VerifiedSteamAPI
