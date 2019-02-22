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

const admincancel = ({
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

  if (parsedCommand.args.length !== 1) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Sir, the command is `!admincancel [@host]`"
    )
  }

  let hostLobbyDiscordId = parseDiscordId(parsedCommand.args[0])
  UserAPI.findByDiscord(hostLobbyDiscordId).then(hostUser => {
    let hostLobbyEnd = LobbiesAPI.getLobbyForHostSafe(
      leagueChannel,
      hostUser.steam
    )
    if (hostLobbyEnd === null) {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Sir, <@" + hostUser.discord + "> is not hosting any lobby."
      )
    } else {
      let regionEnd = hostLobbyEnd["region"]

      LobbiesAPI.deleteLobby(leagueChannel, hostUser.steam)
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Sir, I cancelled <@" +
          hostUser.discord +
          ">'s lobby for @" +
          regionEnd +
          "."
      )
      MessagesAPI.sendDM(
        hostUser.discord,
        "**Your lobby in <#" +
          message.channel.id +
          " was cancelled by an admin.**"
      )
    }
  })
}

module.exports = {
  function: admincancel,
  isAdmin: true,
  isOnlyLobby: true,
  scopes: ["lobbies"]
}
