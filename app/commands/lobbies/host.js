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
} = require("../../../config")
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

const host = ({
  parsedCommand,
  user,
  message,
  leagueRole,
  leagueChannel,
  leagueChannelRegion
}) => {
  if (disableLobbyCommands === true) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      botDownMessage
    )
    return 0
  }
  if (disableLobbyHost === true) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Lobby hosting disabled. Bot is going down for maintenance."
    )
  }

  let hostLobbyExist = LobbiesAPI.getLobbyForHostSafe(leagueChannel, user.steam)

  if (hostLobbyExist !== null) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "You are already hosting a lobby. Type `!lobby` to see players."
    )
    return 0
  }
  if (parsedCommand.args.length === 0) {
    if (leagueChannelRegion !== null) {
      parsedCommand.args[0] = leagueChannelRegion
    } else {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Invalid arguments. Try `!host [" +
          validRegions.join(", ").toLowerCase() +
          "] [rank-1]`. Example: `!host na bishop-1`. (no spaces in rank)"
      )
      return 0
    }
  }

  let region = parsedCommand.args[0].toUpperCase()

  if (leagueChannelRegion !== null && leagueChannelRegion !== region) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "You can only host " +
        leagueChannelRegion +
        " region lobbies in this channel."
    )
    return 0
  }

  let rankRequirement = leagueRequirements[leagueRole]

  if (parsedCommand.args.length === 1) {
    rankRequirement = leagueRequirements[leagueRole]
  } else if (parsedCommand.args.length === 2) {
    rankRequirement = RanksAPI.parseRank(parsedCommand.args[1])

    if (rankRequirement === null) {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Invalid rank requirement. Example: `!host " +
          region.toLowerCase() +
          " bishop-1`. (no spaces in rank)"
      )
      return 0
    }
  } else if (parsedCommand.args.length > 2) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Invalid arguments. Must be `!host [" +
        validRegions.join(", ").toLowerCase() +
        "]` [rank-1]`. Example: `!host na bishop-1`. (no spaces in rank)"
    )
    return 0
  }

  if (!validRegions.includes(region)) {
    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Invalid arguments. Must be `!host [" +
        validRegions.join(", ").toLowerCase() +
        "] [rank-1]`. Example: `!host na bishop-1`. (no spaces in rank)"
    )
    return 0
  }

  // create lobby
  RanksAPI.getRankFromSteamID(user.steam).then(rank => {
    if (rank === null) {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "I am having problems verifying your rank."
      )
      return 0
    }
    let rankUpdate = { rank: rank.mmr_level, score: rank.score }
    if (rank.score === null) delete rankUpdate["score"]
    user.update(rankUpdate)
    let minHostRankRestrictions = rank.mmr_level - 2
    if (rank.mmr_level < leagueRequirements[leagueRole]) {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "You are not high enough rank to host this lobby. (Your rank: " +
          RanksAPI.getRankString(rank.mmr_level) +
          ", required rank: " +
          RanksAPI.getRankString(leagueRequirements[leagueRole]) +
          ")"
      )
      return 0
    }
    if (rank.mmr_level < rankRequirement) {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "You are not high enough rank to host this lobby. (Your rank: " +
          RanksAPI.getRankString(rank.mmr_level) +
          ", required rank: " +
          RanksAPI.getRankString(rankRequirement) +
          ")"
      )
      return 0
    }
    if (
      rankRequirement > minHostRankRestrictions &&
      minHostRankRestrictions > leagueRequirements[leagueRole]
    ) {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "You are not high enough rank to host this lobby. The highest rank restriction you can make is 2 ranks below your current rank. (Your rank: " +
          RanksAPI.getRankString(rank.mmr_level) +
          ", maximum rank restriction: " +
          RanksAPI.getRankString(minHostRankRestrictions) +
          ")"
      )
      return 0
    }
    // good to start
    let token = randtoken.generate(5)
    let newLobby = LobbiesAPI.createLobby(
      leagueChannel,
      user.steam,
      region,
      rankRequirement,
      token
    )

    // let currentLobby = getLobbyForPlayer(leagueChannel, user.steam);

    MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "**=== <@&" +
        message.guild.roles.find(r => r.name === region).id +
        "> Lobby started by <@" +
        user.discord +
        ">** " +
        RanksAPI.getRankString(rank.mmr_level) +
        ". **Type \"!join <@" +
        user.discord +
        ">\" to join!** [" +
        RanksAPI.getRankString(newLobby["rankRequirement"]) +
        " required to join] \nThe bot will whisper you the password on Discord. Make sure you are allowing direct messages from server members in your Discord Settings. \nPlease _DO NOT_ post lobby passwords here.",
      false
    )
    MessagesAPI.sendDM(
      message.author.id,
      "<#" +
        message.channel.id +
        "> **Please host a private Dota Auto Chess lobby in @" +
        region +
        " region with the following password:** `" +
        newLobby["password"] +
        "`. \nPlease remember to double check people's ranks and make sure the right ones joined the game before starting. \nYou can see the all players in the lobby by using `!lobby` in the channel. \nWait until the game has started in the Dota 2 client before typing `!start`. \nIf you need to kick a player from the Discord lobby that has not joined your Dota 2 lobby or if their rank changed, use `!kick @player` in the channel."
    )
  })
}

module.exports = {
  function: host,
  isAdmin: false,
  isOnlyLobby: true,
  scopes: ["lobbies"]
}
