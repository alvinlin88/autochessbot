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

const join = ({
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

  let playerLobbyJoin = LobbiesAPI.getLobbyForPlayer(leagueChannel, user.steam)

  if (playerLobbyJoin !== null) {
    MessagesAPI.sendDM(
      message.author.id,
      "<#" +
        message.channel.id +
        "> \"" +
        message.content +
        "\": You are already in a lobby! Use `!leave` to leave."
    )
    MessagesAPI.deleteMessage(message)
    return 0
  }
  if (parsedCommand.args.length === 0) {
    if (leagueChannelRegion === null) {
      MessagesAPI.sendDM(
        message.author.id,
        "<#" +
          message.channel.id +
          "> \"" +
          message.content +
          "\": Need to specify a host or region to join."
      )
      MessagesAPI.deleteMessage(message)
      return 0
    } else {
      parsedCommand.args[0] = leagueChannelRegion
    }
  }

  RanksAPI.getRankFromSteamID(user.steam).then(rank => {
    if (rank === null) {
      MessagesAPI.sendDM(
        message.author.id,
        "<#" +
          message.channel.id +
          "> \"" +
          message.content +
          "\": I am having problems verifying your rank."
      )
      MessagesAPI.deleteMessage(message)
      return 0
    }
    let resultLobbyHostId = null

    if (validRegions.includes(parsedCommand.args[0].toUpperCase())) {
      let region = parsedCommand.args[0].toUpperCase()
      // find host with most users not over 8 and join.

      let lobbiesInLeagueChannel = LobbiesAPI.getLobbiesInChannel(leagueChannel)

      if (Object.keys(lobbiesInLeagueChannel).length === 0) {
        if (leagueChannelRegion !== null) {
          MessagesAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "There are no lobbies currently. Use `!host` or `!host " +
              leagueChannelRegion.toLowerCase() +
              "` to host one!"
          )
          return 0
        } else {
          MessagesAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "There are no lobbies for that region currently. Use `!host " +
              region.toLowerCase() +
              "` to host one!"
          )
          return 0
        }
      }

      let lobbiesFull = 0

      for (let currentHostId in lobbiesInLeagueChannel) {
        if (lobbiesInLeagueChannel.hasOwnProperty(currentHostId)) {
          let hostedLobby = lobbiesInLeagueChannel[currentHostId]
          if (hostedLobby.players.length < 8) {
            if (
              rank.mmr_level >= hostedLobby["rankRequirement"] &&
              hostedLobby["region"] === region
            ) {
              if (resultLobbyHostId === null) {
                resultLobbyHostId = hostedLobby.host
              } else {
                if (
                  hostedLobby.players.length >
                  lobbiesInLeagueChannel[resultLobbyHostId].players.length
                ) {
                  resultLobbyHostId = hostedLobby.host
                }
              }
            }
          } else if (hostedLobby.players.length === 8) {
            lobbiesFull++
          }
        }
      }

      if (lobbiesFull === Object.keys(lobbiesInLeagueChannel).length) {
        MessagesAPI.sendDM(
          message.author.id,
          "<#" +
            message.channel.id +
            "> \"" +
            message.content +
            "\": All lobbies full. Use `!host [region]` to host another lobby."
        )
        MessagesAPI.deleteMessage(message)
        return 0
      }

      if (resultLobbyHostId === null) {
        MessagesAPI.sendDM(
          message.author.id,
          "<#" +
            message.channel.id +
            "> \"" +
            message.content +
            "\": Host does not exist or you can not join any lobbies (Maybe they are all full? Use `!host [region]` to host a new lobby). Make sure you have the required rank or a lobby for that region exists. Use `!join [@host]` or `!join [region]`."
        )
        MessagesAPI.deleteMessage(message)
        return 0
      }
    }

    let userPromise = null

    if (resultLobbyHostId === null) {
      userPromise = UserAPI.findByDiscord(parseDiscordId(parsedCommand.args[0]))
    } else {
      userPromise = UserAPI.findOneBySteam(resultLobbyHostId)
    }

    userPromise.then(function(hostUser) {
      if (hostUser === null) {
        MessagesAPI.sendDM(
          message.author.id,
          "<#" +
            message.channel.id +
            "> \"" +
            message.content +
            "\": Host not found in database."
        )
        MessagesAPI.deleteMessage(message)
        return 0
      }
      if (!LobbiesAPI.hasHostedLobbyInChannel(leagueChannel, hostUser.steam)) {
        MessagesAPI.sendDM(
          message.author.id,
          "<#" +
            message.channel.id +
            "> \"" +
            message.content +
            "\": Host not found. Use `!list` to see lobbies or `!host [region]` to start one!"
        )
        MessagesAPI.deleteMessage(message)
        return 0
      }

      let lobby = LobbiesAPI.getLobbyForHostSafe(leagueChannel, hostUser.steam)

      if (lobby.players.length === 8) {
        MessagesAPI.sendDM(
          message.author.id,
          "<#" +
            message.channel.id +
            "> \"" +
            message.content +
            "\": That Lobby is full. Use `!host [region]` to start another one."
        )
        MessagesAPI.deleteMessage(message)
        return 0
      }

      let rankUpdate = { rank: rank.mmr_level, score: rank.score }
      if (rank.score === null) delete rankUpdate["score"]
      user.update(rankUpdate)
      if (rank.mmr_level < leagueRequirements[leagueRole]) {
        MessagesAPI.sendDM(
          message.author.id,
          "<#" +
            message.channel.id +
            "> \"" +
            message.content +
            "\":You are not high enough rank to join lobbies in this league. (Your rank: " +
            RanksAPI.getRankString(rank.mmr_level) +
            ", required league rank: " +
            RanksAPI.getRankString(leagueRequirements[leagueRole]) +
            ")"
        )
        MessagesAPI.deleteMessage(message)
        return 0
      }
      if (rank.mmr_level < lobby["rankRequirement"]) {
        MessagesAPI.sendDM(
          message.author.id,
          "<#" +
            message.channel.id +
            "> \"" +
            message.content +
            "\": You are not high enough rank to join this lobby. (Your rank: " +
            RanksAPI.getRankString(rank.mmr_level) +
            ", required lobby rank: " +
            RanksAPI.getRankString(lobby["rankRequirement"]) +
            ")",
          true
        )
        MessagesAPI.deleteMessage(message)
        return 0
      }

      lobby.players.push(user.steam)
      lobby.lastactivity = Date.now()

      getSteamPersonaNames([user.steam]).then(personaNames => {
        MessagesAPI.sendToChannel(
          message.channel.id,
          "<@" +
            message.author.id +
            "> \"" +
            personaNames[user.steam] +
            "\" " +
            RanksAPI.getRankString(rank.mmr_level) +
            " **joined** <@" +
            hostUser.discord +
            "> @" +
            lobby["region"] +
            " region lobby. `(" +
            lobby.players.length +
            "/8)`"
        )
        MessagesAPI.sendDM(
          hostUser.discord,
          "<@" +
            message.author.id +
            "> \"" +
            personaNames[user.steam] +
            "\" " +
            RanksAPI.getRankString(rank.mmr_level) +
            " **joined** your @" +
            lobby["region"] +
            " region lobby in <#" +
            message.channel.id +
            ">. `(" +
            lobby.players.length +
            "/8)`"
        )
        MessagesAPI.sendDM(
          message.author.id,
          "<#" +
            message.channel.id +
            "> Lobby password for <@" +
            hostUser.discord +
            "> " +
            lobby["region"] +
            " region: `" +
            lobby["password"] +
            "`. Please join this lobby in Dota 2 Custom Games. If you cannot find the lobby, try refreshing in your Dota 2 client or whisper the host on Discord to create it <@" +
            hostUser.discord +
            ">."
        )
        if (lobby.players.length === 8) {
          MessagesAPI.sendToChannel(
            message.channel.id,
            "**@" +
              lobby["region"] +
              " Lobby is full! <@" +
              hostUser.discord +
              "> can start the game with `!start`.**",
            false
          )
          MessagesAPI.sendDM(
            hostUser.discord,
            "**@" +
              lobby["region"] +
              " Lobby is full! You can start the game with `!start` in <#" +
              message.channel.id +
              ">.** \n(Only start the game if you have verified everyone in the game lobby. Use `!lobby` to see players.)"
          )
        }
        MessagesAPI.deleteMessage(message)
      })
    })
  })
}

module.exports = {
  function: join,
  isAdmin: false,
  isOnlyLobby: true,
  scopes: ["lobbies"]
}
