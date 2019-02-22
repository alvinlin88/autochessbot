const client = require("../../helpers/client")
const logger = require("../../helpers/logger.js")
const MessagingAPI = require("../../helpers/MessagingAPI")
const RanksAPI = require("../../helpers/RanksAPI")
const LobbiesAPI = require("../../helpers/LobbiesAPI")
const { leagueLobbies, leagueChannelToRegion } = require("../../constants/leagues")
const {
  lobbiesToLeague,
  adminRoleName,
  leagueRoles,
  leagueRequirements,
  validRegions,
  exemptLeagueRolePruning
} = require("../../config")
const randtoken = require("rand-token")
const UserAPI = require("../../helpers/UserAPI")
const VerifiedSteamAPI = require("../../helpers/VerifiedSteamAPI")
const TournamentAPI = require("../../helpers/TournamentAPI")
const parseDiscordId = require("../../helpers/discord/parseDiscordID")
const getSteamPersonaNames = require("../../helpers/steam/getSteamPersonaNames")

let botDownMessage =
  "Bot is restarting. Lobby commands are currently disabled. Be back in a second!"
let disableLobbyCommands = false
let disableLobbyHost = false

const leave = ({
  parsedCommand,
  user,
  message,
  leagueRole,
  leagueChannel,
  leagueChannelRegion
}) => {
  if (disableLobbyCommands === true) {
    MessagingAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      botDownMessage
    )
    return 0
  }

  let playerLobbyLeave = LobbiesAPI.getLobbyForPlayer(leagueChannel, user.steam)

  if (playerLobbyLeave === null) {
    MessagingAPI.sendDM(
      message.author.id,
      "<#" +
        message.channel.id +
        "> \"" +
        message.content +
        "\": You are not in any lobbies."
    )
    MessagingAPI.deleteMessage(message)
    return 0
  }
  if (playerLobbyLeave.host === user.steam) {
    MessagingAPI.sendDM(
      message.author.id,
      "<#" +
        message.channel.id +
        "> \"" +
        message.content +
        "\": Hosts should use `!cancel` instead of `!leave`."
    )
    MessagingAPI.deleteMessage(message)
    return 0
  }

  let hostDiscordQuitId = playerLobbyLeave["host"]
  UserAPI.findOneBySteam(hostDiscordQuitId).then(function(hostUser) {
    if (
      LobbiesAPI.removePlayerFromLobby(
        leagueChannel,
        hostUser.steam,
        user.steam
      )
    ) {
      getSteamPersonaNames([user.steam]).then(personaNames => {
        let numPlayersLeft = LobbiesAPI.getLobbyForHostSafe(
          leagueChannel,
          hostUser.steam
        ).players.length
        MessagingAPI.sendToChannel(
          message.channel.id,
          "<@" +
            message.author.id +
            "> \"" +
            personaNames[user.steam] +
            "\" _**left**_ <@" +
            hostUser.discord +
            "> @" +
            playerLobbyLeave.region +
            " region lobby. `(" +
            numPlayersLeft +
            "/8)`"
        )
        MessagingAPI.sendDM(
          hostUser.discord,
          "<@" +
            message.author.id +
            "> \"" +
            personaNames[user.steam] +
            "\" _**left**_ your @" +
            playerLobbyLeave.region +
            " region lobby in <#" +
            message.channel.id +
            ">. `(" +
            numPlayersLeft +
            "/8)`"
        )
        MessagingAPI.deleteMessage(message)
      })
    }
  })
}

module.exports = {
  function: leave,
  isAdmin: false,
  isOnlyLobby: true,
  scopes: ["lobbies"]
}
