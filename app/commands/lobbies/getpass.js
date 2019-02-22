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

const getpass = ({
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

  let playerSendPassLobby = LobbiesAPI.getLobbyForPlayer(
    leagueChannel,
    user.steam
  )

  if (playerSendPassLobby === null) {
    MessagesAPI.sendDM(
      message.author.id,
      "<#" +
        message.channel.id +
        "> \"" +
        message.content +
        "\": You are not in any lobbies."
    )
    MessagesAPI.deleteMessage(message)
    return 0
  }

  UserAPI.findOneBySteam(playerSendPassLobby.host).then(function(hostUser) {
    if (hostUser === null) {
      MessagesAPI.sendDM(
        message.author.id,
        "<#" +
          message.channel.id +
          "> \"" +
          message.content +
          "\": Host not found in database."
      )
      MessagesAPI.deleteMessage(message)
      return 0
    }
    if (!LobbiesAPI.hasHostedLobbyInChannel(leagueChannel, hostUser.steam)) {
      MessagesAPI.sendDM(
        message.author.id,
        "<#" +
          message.channel.id +
          "> \"" +
          message.content +
          "\": Host not found. Use `!list` to see lobbies or `!host [region]` to start one!"
      )
      MessagesAPI.deleteMessage(message)
      return 0
    }

    let lobby = LobbiesAPI.getLobbyForHostSafe(leagueChannel, hostUser.steam)
    MessagesAPI.sendDM(
      message.author.id,
      "<#" +
        message.channel.id +
        "> \"" +
        message.content +
        "\": Lobby password for <@" +
        hostUser.discord +
        "> " +
        lobby["region"] +
        " region: `" +
        lobby["password"] +
        "`. Please join this lobby in Dota 2 Custom Games. If you cannot find the lobby, whisper the host on Discord to create it <@" +
        hostUser.discord +
        ">."
    )
    MessagesAPI.deleteMessage(message)
  })
}

module.exports = {
  function: getpass,
  isAdmin: false,
  isOnlyLobby: true,
  scopes: ["lobbies"]
}
