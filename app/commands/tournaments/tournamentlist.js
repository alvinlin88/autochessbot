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
let activeTournament = 1

const tournamentlist = ({ parsedCommand, user, message }) => {
  if (
    !message.member.roles.has(
      message.guild.roles.find(r => r.name === adminRoleName).id
    )
  )
    return 0
  let counter = 0
  TournamentAPI.createRegistration(48).then(registrations => {
    registrations.forEach(registration => {
      counter++
      let discordUser = message.guild.members.find(
        r => r.id === registration.discord
      )
      if (discordUser !== null) {
        MessagesAPI.sendToChannel(
          message.channel.id,
          "`(" +
            counter +
            ") " +
            "MMR " +
            registration.score +
            " " +
            registration.region +
            " ` " +
            registration.country +
            " ` " +
            new Date(parseInt(registration.date)).toUTCString() +
            " | " +
            discordUser.user.username +
            "#" +
            discordUser.user.discriminator +
            "`"
        )
      }
    })
  })
}

module.exports = {
  function: tournamentlist,
  isAdmin: true,
  scopes: ["all"]
}
