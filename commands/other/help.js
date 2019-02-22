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
const processRolesUpdate = require("../../helpers/processRolesUpdate")

let botDownMessage =
  "Bot is restarting. Lobby commands are currently disabled. Be back in a second!"
let disableLobbyCommands = false
let disableLobbyHost = false
let activeTournament = 1

const help = ({ parsedCommand, user, message }) => {
  MessagesAPI.sendToChannelWithMention(
    message.channel.id,
    message.author.id,
    "See <#542454956825903104> for more information."
  )
}

module.exports = {
  function: help,
  isAdmin: false,
  scopes: ["all"]
}
