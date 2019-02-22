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

let listratelimit = {}
let botDownMessage =
  "Bot is restarting. Lobby commands are currently disabled. Be back in a second!"
let disableLobbyCommands = false
let disableLobbyHost = false

const list = ({
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

  // Get player info and print out current users in lobby.
  let numPrinted = 0

  if (listratelimit.hasOwnProperty(leagueChannel)) {
    if (Date.now() - listratelimit[leagueChannel] < 15000) {
      MessagesAPI.sendDM(
        message.author.id,
        "<#" +
          message.channel.id +
          "> \"" +
          message.content +
          "\": This command is currently rate limited in <#" +
          message.channel.id +
          ">."
      )
      MessagesAPI.deleteMessage(message)
      // rate limited
      return 0
    }
  }

  let printFullList = false
  if (
    parsedCommand.args.length === 1 &&
    (parsedCommand.args[0] === "full" || parsedCommand.args[0] === "all")
  ) {
    printFullList = true
  }

  listratelimit[leagueChannel] = Date.now()

  MessagesAPI.sendToChannel(
    message.channel.id,
    "**__LOBBY LIST__ - Use `!lobby` to display players in your own lobby**"
  )

  let lobbiesInLeagueChannel = LobbiesAPI.getLobbiesInChannel(leagueChannel)
  for (let hostId in lobbiesInLeagueChannel) {
    if (lobbiesInLeagueChannel.hasOwnProperty(hostId)) {
      let lobby = lobbiesInLeagueChannel[hostId]
      if (lobby.host !== null && lobby.password !== null) {
        UserAPI.findAllUsersWithSteamIdsIn(lobby.players).then(players => {
          getSteamPersonaNames(lobby.players).then(personas => {
            let playerDiscordIds = []
            let hostDiscord = "ERROR"
            let hostDiscordId = null
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
                hostDiscord =
                  "<@" +
                  player.discord +
                  "> \"" +
                  personas[player.steam] +
                  "\" " +
                  RanksAPI.getRankString(player.rank) +
                  " **[Host]**"
                hostDiscordId = player.discord
              }
            })

            let lastActivityStr = ""
            let dontPrint = false
            if (lobby.hasOwnProperty("lastactivity")) {
              let lastActivity = Math.round(
                (Date.now() - new Date(lobby.lastactivity)) / 1000 / 60
              )
              if (lastActivity >= 2) {
                lastActivityStr = " (" + lastActivity + "m last activity)"
              }
              if (
                !dontPrint &&
                lastActivity > 15 &&
                !exemptLeagueRolePruning.includes(leagueRole)
              ) {
                LobbiesAPI.deleteLobby(leagueChannel, lobby.host)
                dontPrint = true
                MessagesAPI.sendToChannel(
                  message.channel.id,
                  "_*** @" +
                    lobby.region +
                    " <@" +
                    hostDiscordId +
                    "> lobby has been removed because of no activity (joins/leaves) for more than 15 minutes._"
                )
                MessagesAPI.sendDM(
                  hostDiscordId,
                  "**Your lobby in <#" +
                    message.channel.id +
                    "> was cancelled because of no activity (joins/leaves) for more than 15 minutes.**"
                )
              }
              if (
                !dontPrint &&
                lastActivity > 5 &&
                lobby.players.length === 8 &&
                !exemptLeagueRolePruning.includes(leagueRole)
              ) {
                LobbiesAPI.deleteLobby(leagueChannel, lobby.host)
                dontPrint = true
                MessagesAPI.sendToChannel(
                  message.channel.id,
                  "_*** @" +
                    lobby.region +
                    " <@" +
                    hostDiscordId +
                    "> lobby has been removed because it is full and has had no activity (joins/leaves) for more than 5 minutes._"
                )
                MessagesAPI.sendDM(
                  hostDiscordId,
                  "**Your lobby in <#" +
                    message.channel.id +
                    "> was cancelled because it was full and had no activity (joins/leaves) for more than 5 minutes. Please use `!start` if the game was loaded in the Dota 2 Client next time.**"
                )
              }
            }
            let lobbyTime = Math.round(
              (Date.now() - new Date(lobby.starttime)) / 1000 / 60
            )
            if (
              !dontPrint &&
              lobbyTime > 60 &&
              !exemptLeagueRolePruning.includes(leagueRole)
            ) {
              LobbiesAPI.deleteLobby(leagueChannel, lobby.host)
              dontPrint = true
              MessagesAPI.sendToChannel(
                message.channel.id,
                "_*** @" +
                  lobby.region +
                  " <@" +
                  hostDiscordId +
                  "> lobby has been removed because it has not started after 60 minutes._"
              )
              MessagesAPI.sendDM(
                hostDiscordId,
                "**Your lobby in <#" +
                  message.channel.id +
                  "> was cancelled because it was not started after 60 minutes. Please use `!start` if the game was loaded in the Dota 2 Client next time.**"
              )
            }

            let fullStr = ""
            let fullStr2 = ""
            let joinStr =
              " | Use \"!join <@" + hostDiscordId + ">\" to join lobby."
            if (lobby.players.length >= 8) {
              fullStr = "~~"
              fullStr2 = "~~"
              joinStr = ""
            }

            if (!dontPrint) {
              if (printFullList === true) {
                MessagesAPI.sendToChannel(
                  message.channel.id,
                  fullStr +
                    "=== **@" +
                    lobby.region +
                    "** [" +
                    RanksAPI.getRankString(lobby.rankRequirement) +
                    "+] `(" +
                    lobby.players.length +
                    "/8)` " +
                    hostDiscord +
                    " | " +
                    playerDiscordIds.join(" | ") +
                    ". (" +
                    lobbyTime +
                    "m)" +
                    lastActivityStr +
                    fullStr2
                )
              } else {
                MessagesAPI.sendToChannel(
                  message.channel.id,
                  fullStr +
                    "=== **@" +
                    lobby.region +
                    "** [" +
                    RanksAPI.getRankString(lobby.rankRequirement) +
                    "+] `(" +
                    lobby.players.length +
                    "/8)` " +
                    hostDiscord +
                    joinStr +
                    " (" +
                    lobbyTime +
                    "m)" +
                    lastActivityStr +
                    fullStr2
                )
              }
            }
          })
        })
      }
    }
    numPrinted++
  }
  if (numPrinted === 0) {
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
        "There are no lobbies for that region currently. Use `!host [region]` to host one!"
      )
      return 0
    }
  }
}

module.exports = {
  function: list,
  isAdmin: false,
  isOnlyLobby: true,
  scopes: ["lobbies"]
}
