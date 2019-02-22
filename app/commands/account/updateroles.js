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
const processRolesUpdate = require("../../helpers/processRolesUpdate")

let botDownMessage =
  "Bot is restarting. Lobby commands are currently disabled. Be back in a second!"
let disableLobbyCommands = false
let disableLobbyHost = false
let activeTournament = 1

const updateroles = ({ parsedCommand, user, message }) => {
  if (message.channel.type === "dm") {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "I can not update roles in direct messages. Please try in <#542465986859761676>."
    )
    return 0
  }
  if (leagueLobbies.includes(message.channel.name)) {
    processRolesUpdate(message, user, true, true, true)
  } else {
    processRolesUpdate(message, user, true, true, false)
  }
}

module.exports = {
  function: updateroles,
  isAdmin: false,
  scopes: ["all"]
}
