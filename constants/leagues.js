const {
  leagueRoles,
  leagueToLobbiesPrefix,
  lobbiesToLeague,
  validRegions
} = require("../config")

let leagueLobbies = []
let leagueChannelToRegion = {}

leagueRoles.forEach(leagueRole => {
  leagueLobbies.push(leagueToLobbiesPrefix[leagueRole])
  lobbiesToLeague[leagueToLobbiesPrefix[leagueRole]] = leagueRole
  leagueChannelToRegion[leagueToLobbiesPrefix[leagueRole]] = null
  validRegions.forEach(leagueRegion => {
    leagueLobbies.push(
      leagueToLobbiesPrefix[leagueRole] + "-" + leagueRegion.toLowerCase()
    )
    lobbiesToLeague[
      leagueToLobbiesPrefix[leagueRole] + "-" + leagueRegion.toLowerCase()
    ] = leagueRole
    leagueChannelToRegion[
      leagueToLobbiesPrefix[leagueRole] + "-" + leagueRegion.toLowerCase()
    ] = leagueRegion
  })
})

module.exports = {
  leagueLobbies,
  leagueChannelToRegion
}