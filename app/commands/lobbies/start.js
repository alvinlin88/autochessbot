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

const start = ({
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

  // check 8/8 then check all ranks, then send passwords
  let lobby = LobbiesAPI.getLobbyForHostSafe(leagueChannel, user.steam)

  if (lobby === undefined || lobby === null) {
    MessagesAPI.sendDM(
      message.author.id,
      "You are not hosting any lobbies in <#" + message.channel.id + ">"
    )
    MessagesAPI.deleteMessage(message)
    return 0
  }

  if (parsedCommand.args.length > 0) {
    // TODO: DRY
    let force = parsedCommand.args[0]

    if (force !== "force") {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Invalid arguments"
      )
      return 0
    }
    if (lobby.players.length < 2) {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "You need at least 2 players to force start a lobby. `(" +
          lobby.players.length +
          "/8)`"
      )
      return 0
    }

    UserAPI.findAllUsersWithSteamIdsIn(lobby.players).then(players => {
      getSteamPersonaNames(lobby.players).then(personas => {
        let playerDiscordIds = []
        let hostUserDiscordId = null

        players.forEach(player => {
          if (player.steam !== lobby.host) {
            playerDiscordIds.push(
              "<@" +
                player.discord +
                "> \"" +
                personas[player.steam] +
                "\" " +
                RanksAPI.getRankString(player.rank) +
                ""
            )
          } else {
            playerDiscordIds.push(
              "<@" +
                player.discord +
                "> \"" +
                personas[player.steam] +
                "\" " +
                RanksAPI.getRankString(player.rank) +
                " **[Host]**"
            )
            hostUserDiscordId = player.discord
          }
        })

        LobbiesAPI.deleteLobby(leagueChannel, user.steam)

        MessagesAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "**@" +
            lobby.region +
            " region lobby started. Good luck!** " +
            playerDiscordIds.join(" | ")
        )
      })
    })
  } else {
    if (lobby.players.length === 8) {
      UserAPI.findAllUsersWithSteamIdsIn(lobby.players).then(players => {
        getSteamPersonaNames(lobby.players).then(personas => {
          let playerDiscordIds = []
          let hostUserDiscordId = null

          players.forEach(player => {
            if (player.steam !== lobby.host) {
              playerDiscordIds.push(
                "<@" +
                  player.discord +
                  "> \"" +
                  personas[player.steam] +
                  "\" " +
                  RanksAPI.getRankString(player.rank)
              )
            } else {
              playerDiscordIds.push(
                "<@" +
                  player.discord +
                  "> \"" +
                  personas[player.steam] +
                  "\" " +
                  RanksAPI.getRankString(player.rank) +
                  " **[Host]**"
              )
              hostUserDiscordId = player.discord
            }
          })

          MessagesAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "**@" +
              lobby["region"] +
              " region lobby started. Good luck!** " +
              playerDiscordIds.join(" | ")
          )
          LobbiesAPI.deleteLobby(leagueChannel, user.steam)
        })
      })
    } else {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Not enough players to start yet. `(" + lobby.players.length + "/8)`"
      )
    }
  }
}

module.exports = {
  function: start,
  isAdmin: false,
  isOnlyLobby: true,
  scopes: ["lobbies"]
}
