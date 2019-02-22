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

const adminkick = ({
  parsedCommand,
  user,
  message,
  leagueRole,
  leagueChannel,
  leagueChannelRegion
}) => {
  if (
    !message.member.roles.has(
      message.guild.roles.find(r => r.name === adminRoleName).id
    )
  )
    return 0

  if (parsedCommand.args.length !== 2) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Sir, the command is `!adminkick [@host] [@player]`."
    )
    return 0
  }
  let hostDiscordIdKick = parseDiscordId(parsedCommand.args[0])
  let playerDiscordIdKick = parseDiscordId(parsedCommand.args[1])

  if (hostDiscordIdKick === null) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Sir, that host id is invalid."
    )
  }
  if (playerDiscordIdKick === null) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Sir, that player id is invalid."
    )
  }

  UserAPI.findByDiscord(hostDiscordIdKick).then(hostUser => {
    UserAPI.findByDiscord(playerDiscordIdKick).then(playerUser => {
      let hostLobby = LobbiesAPI.getLobbyForHostSafe(
        leagueChannel,
        hostUser.steam
      )
      if (hostLobby === null) {
        MessagesAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "Sir, that person is not hosting a lobby currently."
        )
        return 0
      }
      if (hostUser.steam === playerUser.steam) {
        MessagesAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "Sir, you can not kick the host from their own lobby. Use `!admincancel [@host]` instead."
        )
        return 0
      }

      LobbiesAPI.removePlayerFromLobby(
        leagueChannel,
        hostUser.steam,
        playerUser.steam
      )
      let kickUserName = message.client.users.find("id", playerUser.discord)
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "kicked " +
          kickUserName +
          " from <@" +
          hostUser.discord +
          "> @" +
          hostLobby.region +
          " region lobby. `(" +
          LobbiesAPI.getLobbyForHostSafe(leagueChannel, hostUser.steam).players
            .length +
          "/8)`"
      )
      MessagesAPI.sendDM(
        playerUser.discord,
        "<#" +
          message.channel.id +
          "> An admin kicked you from <@" +
          hostUser.discord +
          "> @" +
          hostLobby.region +
          " region lobby."
      )
    })
  })
}

module.exports = {
  function: adminkick,
  isAdmin: true,
  isOnlyLobby: true,
  scopes: ["lobbies"]
}
