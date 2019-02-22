const client = require("../../helpers/client")
const logger = require("../../helpers/logger.js")
const MessagesAPI = require("../../helpers/MessagesAPI")
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
} = require("../../../config")
const randtoken = require("rand-token")
const UserAPI = require("../../helpers/UserAPI")
const VerifiedSteamAPI = require("../../helpers/VerifiedSteamAPI")
const TournamentAPI = require("../../helpers/TournamentAPI")
const parseDiscordId = require("../../helpers/discord/parseDiscordID")
const getSteamPersonaNames = require("../../helpers/steam/getSteamPersonaNames")
const processRolesUpdate = require("../../helpers/processRolesUpdate")

let botDownMessage =
  "Bot is restarting. Lobby commands are currently disabled. Be back in a second!"
let disableLobbyCommands = false
let disableLobbyHost = false

const adminupdateroles = ({
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

  if (message.channel.type === "dm") {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Sir, I can not update roles in direct messages. Please try in a channel on the server."
    )
    return 0
  }
  if (parsedCommand.args.length < 1) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Sir, the command is `!adminlink [@discord] [[steamid]]`"
    )
    return 0
  }
  let updateRolePlayerDiscordId = parseDiscordId(parsedCommand.args[0])

  UserAPI.findByDiscord(updateRolePlayerDiscordId).then(function(playerUser) {
    if (playerUser === null) {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Sir, I could not find that user."
      )
      return 0
    }
    processRolesUpdate(message, playerUser, true, true)
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Sir, trying to update roles for <@" + playerUser.discord + ">."
    )
  })
}

module.exports = {
  function: adminupdateroles,
  isAdmin: true,
  scopes: ["all"]
}
