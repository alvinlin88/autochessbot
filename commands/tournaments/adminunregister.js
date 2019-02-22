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
let activeTournament = 1

const adminunregister = ({ parsedCommand, user, message }) => {
  if (message.author.id !== "204094307689431043") return 0 // no permissions

  let discordUser = parseDiscordId(parsedCommand.args[0])

  TournamentAPI.findRegistration({ discord: discordUser }).then(
    registration => {
      registration.destroy().then(deleted => {
        MessagesAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "Sir, I deleted that tournament registration by <@" +
            deleted.discord +
            ">"
        )
      })
    }
  )
}

module.exports = {
  function: adminunregister,
  isAdmin: true,
  scopes: ["tournament"]
}
