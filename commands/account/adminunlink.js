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
} = require("../../app/config")
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

const adminunlink = ({ parsedCommand, user, message }) => {
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
      "Sir, the command is `!adminunlink [@discord]`"
    )
    return 0
  }
  let unlinkPlayerDiscordId = parseDiscordId(parsedCommand.args[0])

  UserAPI.findByDiscord(unlinkPlayerDiscordId).then(function(unlinkPlayerUser) {
    let oldSteamID = unlinkPlayerUser.steam
    unlinkPlayerUser.update({ steam: null, validated: false }).then(
      function(result) {
        MessagesAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "Sir, I have unlinked <@" +
            unlinkPlayerUser.discord +
            ">'s steam id. `" +
            oldSteamID +
            "`"
        )
      },
      function(error) {
        logger.error(error)
      }
    )
  })
}

module.exports = {
  function: adminunlink,
  isAdmin: true,
  scopes: ["all"]
}
