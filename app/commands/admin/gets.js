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

const gets = ({ parsedCommand, user, message }) => {
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
      "Sir, the command is `!admingetsteam [@discord]`"
    )
    return 0
  }
  let infoPlayerDiscordId = parseDiscordId(parsedCommand.args[0])

  if (infoPlayerDiscordId === null) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Sir, that is an invalid Discord ID. Make sure it is a mention (blue text)."
    )
    return 0
  }

  UserAPI.findUserAndVerifiedSteamsByDiscord(infoPlayerDiscordId).then(function(
    infoPlayerUser
  ) {
    if (infoPlayerUser === null) {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Sir, I did not find any matches in database for <@" +
          infoPlayerDiscordId +
          ">"
      )
      return 0
    }
    if (infoPlayerUser.steam === null) {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Sir, I could not find a steam id for <@" +
          infoPlayerUser.discord +
          ">."
      )
      return 0
    }
    if (
      infoPlayerUser.validated === false &&
      infoPlayerUser.verifiedSteams.length === 0
    ) {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        `Sir, <@${infoPlayerUser.discord}> is linked to steam id ${
          infoPlayerUser.steam
        } (not verified).`
      )
      return 0
    }

    let verifiedSteams = infoPlayerUser.verifiedSteams
      .map(verifiedSteam => {
        let active =
          verifiedSteam.steam === infoPlayerUser.steam ? "(active)" : ""
        return `\`${verifiedSteam.steam}${active}\``
      })
      .join(",")
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      `Sir, <@${
        infoPlayerUser.discord
      }> is linked to steam id: ${verifiedSteams}.`
    )
  })
}

module.exports = {
  function: gets,
  isAdmin: true,
  scopes: ["all"]
}
