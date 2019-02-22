const client = require("../../helpers/client")
const logger = require("../../helpers/logger.js")
const MessagingAPI = require("../../helpers/MessagingAPI")
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

const getp = ({ parsedCommand, user, message }) => {
  if (parsedCommand.args.length === 1) {
    let getSteamPersonaUserDiscordId = parseDiscordId(parsedCommand.args[0])

    if (getSteamPersonaUserDiscordId !== null) {
      if (!message.guild.member(getSteamPersonaUserDiscordId)) {
        MessagingAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "Could not find that user on this server."
        )
        return 0
      }
      UserAPI.findByDiscord(getSteamPersonaUserDiscordId).then(
        getSteamPersonaUser => {
          getSteamPersonaNames([getSteamPersonaUser.steam]).then(personas => {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "<@" +
                getSteamPersonaUser.discord +
                "> Steam Name is \"" +
                personas[getSteamPersonaUser.steam] +
                "\""
            )
          })
        }
      )
    } else {
      MessagingAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Invalid arguments."
      )
    }
  }
}

module.exports = {
  function: getp,
  isAdmin: true,
  scopes: ["all"]
}
