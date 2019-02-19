const fs = require("fs")
const config = require("./config")
const CronJob = require("cron").CronJob
const logger = require("./helpers/logger.js")

module.exports = class Lobbies {
  constructor() {
    this.lobbies = {}
    this.backupJob = new CronJob(
      config.lobbies_backup_cron,
      function() {
        this.backupLobbies()
      }.bind(this),
      null,
      /* don't start right after init */ false,
      "America/Los_Angeles"
    )
  }

  initialize() {
    config.leagueRoles.forEach(leagueRole => {
      this.lobbies[config.leagueToLobbiesPrefix[leagueRole]] = {}
      config.validRegions.forEach(leagueRegion => {
        this.lobbies[
          config.leagueToLobbiesPrefix[leagueRole] +
            "-" +
            leagueRegion.toLowerCase()
        ] = {}
      })
    })
  }

  getLobbiesInChannel(leagueChannel) {
    return this.lobbies[leagueChannel]
  }

  // This version is guarded with existence check
  getLobbyForHostSafe(leagueChannel, hostUserSteam) {
    let result = null
    for (let hostId in this.lobbies[leagueChannel]) {
      if (this.lobbies[leagueChannel].hasOwnProperty(hostId)) {
        let lobby = this.lobbies[leagueChannel][hostId]

        if (lobby["host"] === hostUserSteam) {
          result = lobby
        }
      }
    }
    return result
  }

  hasHostedLobbyInChannel(leagueChannel, hostUserSteam) {
    return this.lobbies[leagueChannel].hasOwnProperty(hostUserSteam)
  }

  // isn't this always the case?
  isHostOfHostedLobby(leagueChannel, hostUserSteam) {
    return this.lobbies[leagueChannel][hostUserSteam]["host"] === hostUserSteam
  }

  getLobbyForHost(leagueChannel, hostUserSteam) {
    return this.lobbies[leagueChannel][hostUserSteam]
  }

  getLobbyForPlayer(leagueChannel, player) {
    let result = null
    for (let hostId in this.lobbies[leagueChannel]) {
      if (this.lobbies[leagueChannel].hasOwnProperty(hostId)) {
        let lobby = this.lobbies[leagueChannel][hostId]

        lobby["players"].forEach(p => {
          if (p === player) {
            result = lobby
          }
        })
      }
    }
    return result
  }

  backupLobbies() {
    this.overwriteBackupFile(JSON.stringify(this.lobbies))
  }

  restoreLobbies() {
    try {
      let lobbiesData = fs.readFileSync(config.lobbies_file, "utf8")
      this.lobbies = JSON.parse(lobbiesData)
    } catch (e) {
      this.overwriteBackupFile("")
      this.initialize()
    }
  }

  // does not write an empty backup file if read fails
  restoreLobbiesSafe() {
    let lobbiesData = fs.readFileSync(config.lobbies_file, "utf8")
    this.lobbies = JSON.parse(lobbiesData)
  }

  overwriteBackupFile(content) {
    fs.writeFileSync(config.lobbies_file, content, err => {
      if (err) {
        logger.error(err)
      }
    })
  }

  deleteLobby(leagueChannel, hostUserSteam) {
    delete this.lobbies[leagueChannel][hostUserSteam]
  }

  // returns true if the player was in the lobby and now removed, false otherwise.
  removePlayerFromLobby(leagueChannel, hostUserSteam, playerUserSteam) {
    let lobby = this.lobbies[leagueChannel][hostUserSteam]
    let index = lobby.players.indexOf(playerUserSteam)

    if (index > -1) {
      lobby.players.splice(index, 1)
      lobby.lastactivity = Date.now()
      return true
    }
    return false
  }

  createLobby(leagueChannel, hostUserSteam, region, rankRequirement, token) {
    let newLobby = {
      host: hostUserSteam,
      password: region.toLowerCase() + "_" + token.toLowerCase(),
      players: [hostUserSteam],
      region: region,
      rankRequirement: rankRequirement,
      starttime: Date.now(),
      lastactivity: Date.now()
    }
    this.lobbies[leagueChannel][hostUserSteam] = newLobby
    return newLobby
  }

  resetLobbies(leagueChannel) {
    this.lobbies[leagueChannel] = {}
  }

  removeLobbies(leagueChannel) {
    delete this.lobbies[leagueChannel]
  }

  startBackupJob() {
    this.backupJob.start()
  }
}
