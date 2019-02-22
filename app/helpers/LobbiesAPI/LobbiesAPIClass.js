const fs = require("fs")
const LeaguesAPI = require("../LeaguesAPI")
const config = require("../../../config")
const { CronJob } = require("cron")
const logger = require("../logger.js")

class LobbiesAPIClass {
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
    LeaguesAPI.getAllLeaguesChannels().forEach(channel => {
      this.lobbies[channel] = {}
    })
  }

  getLobbiesInChannel(channel) {
    return this.lobbies[channel]
  }

  // This version is guarded with existence check
  getLobbyForHostSafe(channel, hostUserSteam) {
    let result = null
    for (let hostId in this.lobbies[channel]) {
      if (this.lobbies[channel].hasOwnProperty(hostId)) {
        let lobby = this.lobbies[channel][hostId]

        if (lobby["host"] === hostUserSteam) {
          result = lobby
        }
      }
    }
    return result
  }

  hasHostedLobbyInChannel(channel, hostUserSteam) {
    return this.lobbies[channel].hasOwnProperty(hostUserSteam)
  }

  // isn't this always the case?
  isHostOfHostedLobby(channel, hostUserSteam) {
    return this.lobbies[channel][hostUserSteam]["host"] === hostUserSteam
  }

  getLobbyForHost(channel, hostUserSteam) {
    return this.lobbies[channel][hostUserSteam]
  }

  getLobbyForPlayer(channel, player) {
    let result = null
    for (let hostId in this.lobbies[channel]) {
      if (this.lobbies[channel].hasOwnProperty(hostId)) {
        let lobby = this.lobbies[channel][hostId]

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

  deleteLobby(channel, hostUserSteam) {
    delete this.lobbies[channel][hostUserSteam]
  }

  // returns true if the player was in the lobby and now removed, false otherwise.
  removePlayerFromLobby(channel, hostUserSteam, playerUserSteam) {
    let lobby = this.lobbies[channel][hostUserSteam]
    let index = lobby.players.indexOf(playerUserSteam)

    if (index > -1) {
      lobby.players.splice(index, 1)
      lobby.lastactivity = Date.now()
      return true
    }
    return false
  }

  createLobby(channel, hostUserSteam, region, rankRequirement, token) {
    let newLobby = {
      host: hostUserSteam,
      password: region.toLowerCase() + "_" + token.toLowerCase(),
      players: [hostUserSteam],
      region: region,
      rankRequirement: rankRequirement,
      starttime: Date.now(),
      lastactivity: Date.now()
    }
    this.lobbies[channel][hostUserSteam] = newLobby
    return newLobby
  }

  resetLobbies(channel) {
    this.lobbies[channel] = {}
  }

  removeLobbies(channel) {
    delete this.lobbies[channel]
  }

  startBackupJob() {
    this.backupJob.start()
  }
}

module.exports = LobbiesAPIClass
