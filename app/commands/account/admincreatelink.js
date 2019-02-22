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

const admincreatelink = ({ parsedCommand, user, message }) => {
  if (
    !message.member.roles.has(
      message.guild.roles.find(r => r.name === adminRoleName).id
    )
  )
    return 0

  if (parsedCommand.args.length < 1) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Sir, the command is `!adminlink [@discord] [[steamid]]`"
    )
    return 0
  }
  let createLinkPlayerDiscordId = parseDiscordId(parsedCommand.args[0])
  let forceSteamIdLink = parsedCommand.args[1]

  UserAPI.findByDiscord(createLinkPlayerDiscordId).then(function(
    linkPlayerUser
  ) {
    if (linkPlayerUser === null) {
      UserAPI.create({
        discord: createLinkPlayerDiscordId,
        steam: forceSteamIdLink,
        validated: false
      })
        .then(() => {
          MessagesAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, I have linked <@" +
              createLinkPlayerDiscordId +
              "> steam id `" +
              forceSteamIdLink +
              "`. Remember they will not have any roles. Use `!adminupdateroles [@discord]`."
          )
        })
        .catch(function(msg) {
          logger.error("error " + msg)
        })
    } else {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Sir, <@" +
          createLinkPlayerDiscordId +
          "> is already linked to steam id `" +
          linkPlayerUser.steam +
          "`. Use `!adminupdatelink [@discord] [steam]` instead."
      )
      return 0
    }
  })
}

module.exports = {
  function: admincreatelink,
  isAdmin: true,
  scopes: ["all"]
}
