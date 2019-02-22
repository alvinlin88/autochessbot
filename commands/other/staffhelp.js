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
} = require("../../app/config")
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
let activeTournament = 1

const staffhelp = ({ parsedCommand, user, message }) => {
  if (parsedCommand.args.length === 0) {
    MessagesAPI.sendDM(
      message.author.id,
      "Sir, the command is !staffhelp [@discord] [topic] [[language]]."
    )
    MessagesAPI.deleteMessage(message)
    return 0
  }
  let staffHelpUserDiscordId = parseDiscordId(parsedCommand.args[0])
  if (staffHelpUserDiscordId === null) {
    MessagesAPI.sendDM(
      message.author.id,
      "Sir, that is an invalid Discord ID.  Make sure it is a mention (blue text)."
    )
    MessagesAPI.deleteMessage(message)
    return 0
  }

  if (staffHelpUserDiscordId !== null) {
    if (!message.guild.member(staffHelpUserDiscordId)) {
      MessagesAPI.sendDM(
        message.author.id,
        "Sir, I could not find that user on this server."
      )
      MessagesAPI.deleteMessage(message)
      return 0
    }
  }

  let lang = parsedCommand.args[2]
  if (lang === null) {
    lang = "en"
  }

  let topic = parsedCommand.args[1]
  let helptext = ""

  switch (topic) {
    case "tony":
      helptext = {
        en: "Tony is a pepega, don't complain about losing if you go him.",
        ru: "Russian here"
      }[lang]
      break
    default:
      MessagesAPI.sendDM(message.author.id, "Could not find that help topic.")
      MessagesAPI.deleteMessage(message)
      return 0
  }

  MessagesAPI.sendToChannelWithMention(
    message.channel.id,
    staffHelpUserDiscordId,
    helptext
  )
}

module.exports = {
  function: staffhelp,
  isAdmin: false,
  scopes: ["all"]
}
