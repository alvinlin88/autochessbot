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

const lobby = ({
  parsedCommand,
  user,
  message,
  leagueRole,
  leagueChannel,
  leagueChannelRegion
}) => {
  if (disableLobbyCommands === true) {
    MessagingAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      botDownMessage
    )
    return 0
  }
  if (parsedCommand.args.length === 0) {
    // MessagingAPI.sendToChannelWithMention(message.channel.id, message.author.id, "You need to specify a host.");
    // return 0;
    parsedCommand.args[0] = "<@" + message.author.id + ">"
  }
  let lobbyHostDiscordId = parseDiscordId(parsedCommand.args[0])

  // if (!message.guild.member(lobbyHostDiscordId)) {
  //     MessagingAPI.sendToChannelWithMention(message.channel.id, message.author.id, "Could not find that user on this server.");
  //     return 0;
  // }
  UserAPI.findByDiscord(lobbyHostDiscordId).then(hostUser => {
    let lobby = LobbiesAPI.getLobbyForPlayer(leagueChannel, hostUser.steam)

    if (lobby === null) {
      MessagingAPI.sendDM(
        message.author.id,
        "<#" +
          message.channel.id +
          "> \"" +
          message.content +
          "\": That user is not (or you are not) hosting any lobbies."
      )
      MessagingAPI.deleteMessage(message)
      return 0
    }

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
          if (lobby.hasOwnProperty("lastacitivity")) {
            let lastActivity = Math.round(
              (Date.now() - new Date(lobby.lastactivity)) / 1000 / 60
            )
            if (lastActivity > 5) {
              lastActivityStr = " (" + +"m last activity)"
            }
          }
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "=== **@" +
              lobby.region +
              " [**" +
              RanksAPI.getRankString(lobby.rankRequirement) +
              "**+]** `(" +
              lobby.players.length +
              "/8)` " +
              hostDiscord +
              " | " +
              playerDiscordIds.join(" | ") +
              ". (" +
              Math.round((Date.now() - new Date(lobby.starttime)) / 1000 / 60) +
              "m)" +
              lastActivityStr
          )
          // also whisper
          MessagingAPI.sendDM(
            message.author.id,
            "=== **@" +
              lobby.region +
              "** [" +
              RanksAPI.getRankString(lobby.rankRequirement) +
              "+] `(" +
              lobby.players.length +
              "/8)`\n" +
              hostDiscord +
              "\n" +
              playerDiscordIds.join("\n") +
              "\n(Last activity: " +
              Math.round((Date.now() - new Date(lobby.starttime)) / 1000 / 60) +
              "m)" +
              lastActivityStr
          )
          MessagingAPI.deleteMessage(message)
        })
      })
    }
  })
}

module.exports = {
  function: lobby,
  isAdmin: false,
  isOnlyLobby: true,
  scopes: ["lobbies"]
}
