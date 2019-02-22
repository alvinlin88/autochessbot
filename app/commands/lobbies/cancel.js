const client = require("../../helpers/client")
const logger = require("../../helpers/logger.js")
const MessagesAPI = require("../../helpers/MessagesAPI")
const RanksAPI = require("../../helpers/RanksAPI")
const LobbiesAPI = require("../../helpers/LobbiesAPI")
const {
  leagueLobbies,
  leagueChannelToRegion
} = require("../../constants/leagues")
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

const cancel = ({
  parsedCommand,
  user,
  message,
  leagueRole,
  leagueChannel,
  leagueChannelRegion
}) => {
  if (disableLobbyCommands === true) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      botDownMessage
    )
    return 0
  }

  let hostLobbyEnd = LobbiesAPI.getLobbyForHostSafe(leagueChannel, user.steam)

  if (hostLobbyEnd === null) {
    MessagesAPI.sendDM(
      message.author.id,
      "<#" +
        message.channel.id +
        "> \"" +
        message.content +
        "\": You are not hosting any lobbies in <#" +
        message.channel.id +
        ">"
    )
    MessagesAPI.deleteMessage(message)
    return 0
  }
  let regionEnd = hostLobbyEnd["region"]

  if (LobbiesAPI.isHostOfHostedLobby(leagueChannel, user.steam)) {
    LobbiesAPI.deleteLobby(leagueChannel, user.steam)
    MessagesAPI.sendToChannel(
      message.channel.id,
      "<@" + user.discord + "> @" + regionEnd + " region **lobby cancelled**."
    )
    return 0
  }
}

module.exports = {
  function: cancel,
  isAdmin: false,
  isOnlyLobby: true,
  scopes: ["lobbies"]
}
