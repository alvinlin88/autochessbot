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
let activeTournament = 1

const createtournament = ({ parsedCommand, user, message }) => {
  if (message.author.id !== "204094307689431043") return 0 // no permissions

  TournamentAPI.createTournament({
    name: "Team Liquid & qihl Auto Chess Masters",
    description:
      "- 32 Players, with only the highest ranking players who sign-up getting to compete.\n- 5 Round point-based format.\n- $400 prize pool: $200 for first place, $125 for second place, and $75 for third.",
    signupstartdatetime: Date.now(),
    signupenddatetime: Date.now(),
    tournamentstartdatetime: Date.now(),
    tournamentenddatetime: Date.now(),
    tournamentsettings: JSON.stringify({ test: "test" })
  }).then(tournament => {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Created!"
    )
  })
}

module.exports = {
  function: createtournament,
  isAdmin: true,
  scopes: ["all"]
}
