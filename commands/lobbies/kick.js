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

const kick = ({
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

  let hostLobby = LobbiesAPI.getLobbyForHostSafe(leagueChannel, user.steam)

  if (hostLobby === null) {
    MessagingAPI.sendDM(
      message.author.id,
      "<#" +
        message.channel.id +
        "> \"" +
        message.content +
        "\": You are not hosting any lobbies in <#" +
        message.channel.id +
        ">"
    )
    MessagingAPI.deleteMessage(message)
    return 0
  }
  if (parsedCommand.args.length < 1) {
    MessagingAPI.sendDM(
      message.author.id,
      "<#" +
        message.channel.id +
        "> \"" +
        message.content +
        "\": You need to specify a player to kick: `!kick @quest`"
    )
    MessagingAPI.deleteMessage(message)
    return 0
  }
  let kickedPlayerDiscordId = parseDiscordId(parsedCommand.args[0])

  if (!message.guild.member(kickedPlayerDiscordId)) {
    MessagingAPI.sendDM(
      message.author.id,
      "<#" +
        message.channel.id +
        "> \"" +
        message.content +
        "\": Could not find that user on this server."
    )
    MessagingAPI.deleteMessage(message)
    return 0
  }
  UserAPI.findByDiscord(kickedPlayerDiscordId).then(function(kickedPlayerUser) {
    if (kickedPlayerUser === null) {
      MessagingAPI.sendDM(
        message.author.id,
        "<#" +
          message.channel.id +
          "> \"" +
          message.content +
          "\": User not in database. Make sure to use mentions in command: `!kick @username`"
      )
      MessagingAPI.deleteMessage(message)
      return 0
    }
    if (hostLobby.players.length === 1) {
      MessagingAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "You can not kick the last player."
      )
      return 0
    }
    if (hostLobby.host === kickedPlayerUser.steam) {
      MessagingAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "You can not kick yourself. (Use !cancel to cancel a lobby you have hosted)"
      )
      return 0
    }
    if (!hostLobby.players.includes(kickedPlayerUser.steam)) {
      MessagingAPI.sendDM(
        message.author.id,
        "<#" +
          message.channel.id +
          "> \"" +
          message.content +
          "\": User not in lobby."
      )
      MessagingAPI.deleteMessage(message)
      return 0
    }

    if (
      LobbiesAPI.removePlayerFromLobby(
        leagueChannel,
        user.steam,
        kickedPlayerUser.steam
      )
    ) {
      let kickUserName = message.client.users.find("id", kickedPlayerDiscordId)
      MessagingAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "kicked " +
          kickUserName +
          " from <@" +
          user.discord +
          "> @" +
          hostLobby.region +
          " region lobby. `(" +
          LobbiesAPI.getLobbyForHostSafe(leagueChannel, user.steam).players
            .length +
          "/8)`"
      )
      MessagingAPI.sendDM(
        kickedPlayerDiscordId,
        "<@" +
          user.discord +
          "> kicked you from their lobby in <#" +
          message.channel.id +
          ">."
      )
    }
  })
}

module.exports = {
  function: kick,
  isAdmin: false,
  isOnlyLobby: true,
  scopes: ["lobbies"]
}
