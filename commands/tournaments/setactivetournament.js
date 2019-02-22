const client = require("../../helpers/client")
const logger = require("../../helpers/logger.js")
const MessagingAPI = require("../../helpers/MessagingAPI")
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

let botDownMessage =
  "Bot is restarting. Lobby commands are currently disabled. Be back in a second!"
let disableLobbyCommands = false
let disableLobbyHost = false
let activeTournament = 1

const setactivetournament = ({ parsedCommand, user, message }) => {
  if (message.author.id !== "204094307689431043") return 0 // no permissions

  if (parsedCommand.args.length !== 1) {
    MessagingAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "!setactivetournament [id]"
    )
  }

  activeTournament = parsedCommand.args[0]
}

module.exports = {
  function: setactivetournament,
  isAdmin: true,
  scopes: ["all"]
}
