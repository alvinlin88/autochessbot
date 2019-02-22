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

const adminunlinksteam = ({ parsedCommand, user, message }) => {
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
      "Sir, the command is `!adminunlink [steamid]`"
    )
    return 0
  }
  if (!parseInt(parsedCommand.args[0])) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Sir, that is an invalid steam id"
    )
    return 0
  }
  let unlinkPlayerSteamId = parsedCommand.args[0]
  VerifiedSteamAPI.findOneBySteam(unlinkPlayerSteamId).then(verifiedSteam => {
    if (verifiedSteam !== null) {
      verifiedSteam
        .destroy()
        .then(() =>
          MessagesAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            `Sir, I have removed verified steam id record for \`${unlinkPlayerSteamId}\``
          )
        )
    }
  })

  UserAPI.findAllBySteam(unlinkPlayerSteamId).then(function(unlinkPlayerUsers) {
    unlinkPlayerUsers.forEach(unlinkPlayerUser => {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Sir, I have unlinked <@" + unlinkPlayerUser.discord + ">'s steam id."
      )
      unlinkPlayerUser.update({ steam: null, validated: false })
    })
  })
}

module.exports = {
  function: adminunlinksteam,
  isAdmin: true,
  scopes: ["all"]
}
