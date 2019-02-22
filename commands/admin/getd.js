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

const getd = ({ parsedCommand, user, message }) => {
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
      "Sir, the command is `!admingetdiscord [steam]`"
    )
    return 0
  }
  const steamId = parsedCommand.args[0]

  if (!parseInt(steamId)) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Sir, that is an invalid steam id"
    )
    return 0
  }

  UserAPI.findAllBySteam(steamId).then(players => {
    let playerDiscordIds = []

    // TODO: recheck ranks here
    players.forEach(player => {
      playerDiscordIds.push(
        "<@" + player.discord + "> `<@" + player.discord + ">`"
      )
    })

    if (playerDiscordIds.length >= 1) {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Sir, I found these users for `" +
          steamId +
          "`: " +
          playerDiscordIds.join(", ") +
          "."
      )
    } else {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Sir, I did not find any matches in database for `" + steamId + "`."
      )
    }
  })
}

module.exports = {
  function: getd,
  isAdmin: true,
  scopes: ["all"]
}
