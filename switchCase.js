const client = require("./helpers/client")
const logger = require("./helpers/logger.js")
const MessagingAPI = require("./helpers/MessagingAPI")
const RanksAPI = require("./helpers/RanksAPI")
const { leagueLobbies, leagueChannelToRegion } = require("./constants/leagues")
const {
  lobbiesToLeague,
  adminRoleName,
  leagueRoles,
  leagueRequirements,
  validRegions,
  exemptLeagueRolePruning
} = require("./config")
const randtoken = require("rand-token")
const UserAPI = require("./helpers/UserAPI")
const VerifiedSteamAPI = require("./helpers/VerifiedSteamAPI")
const TournamentAPI = require("./helpers/TournamentAPI")
const parseDiscordId = require("./helpers/discord/parseDiscordID")
const getSteamPersonaNames = require("./helpers/steam/getSteamPersonaNames")
const updateRoles = require("./commands/updateRoles")

const Lobbies = require("./lobbies.js"),
  lobbies = new Lobbies()
lobbies.restoreLobbies()
lobbies.startBackupJob()

let botDownMessage =
  "Bot is restarting. Lobby commands are currently disabled. Be back in a second!"

let listratelimit = {}
let disableLobbyCommands = false
let disableLobbyHost = false

let activeTournament = 1

const switchCase = ({ parsedCommand, user, message }) => {
  let isLobbyCommand = null

  if (user === null || user.steam === null) {
    const readme = client.channels.find(r => r.name === "readme").id
    MessagingAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      `You need to complete verification to use bot commands. See <#${readme}> for more information.`
    )
    updateRoles(message, user, false, false, true)
    return 0
  }

  if (leagueLobbies.includes(message.channel.name)) {
    let leagueRole = lobbiesToLeague[message.channel.name]
    let leagueChannel = message.channel.name
    let leagueChannelRegion = leagueChannelToRegion[leagueChannel]

    switch (parsedCommand.command) {
      case "admincancel":
      case "adminclose":
      case "adminend":
      case "adminunhost":
        (function() {
          if (
            !message.member.roles.has(
              message.guild.roles.find(r => r.name === adminRoleName).id
            )
          )
            return 0

          if (parsedCommand.args.length !== 1) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "Sir, the command is `!admincancel [@host]`"
            )
          }

          let hostLobbyDiscordId = parseDiscordId(parsedCommand.args[0])
          UserAPI.findByDiscord(hostLobbyDiscordId).then(hostUser => {
            let hostLobbyEnd = lobbies.getLobbyForHostSafe(leagueChannel, hostUser.steam)
            if (hostLobbyEnd === null) {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Sir, <@" + hostUser.discord + "> is not hosting any lobby."
              )
            } else {
              let regionEnd = hostLobbyEnd["region"]

              lobbies.deleteLobby(leagueChannel, hostUser.steam)
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Sir, I cancelled <@" +
                  hostUser.discord +
                  ">'s lobby for @" +
                  regionEnd +
                  "."
              )
              MessagingAPI.sendDM(
                hostUser.discord,
                "**Your lobby in <#" +
                  message.channel.id +
                  " was cancelled by an admin.**"
              )
            }
          })
        })()
        break
      case "adminkick":
        (function() {
          if (
            !message.member.roles.has(
              message.guild.roles.find(r => r.name === adminRoleName).id
            )
          )
            return 0

          if (parsedCommand.args.length !== 2) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "Sir, the command is `!adminkick [@host] [@player]`."
            )
            return 0
          }
          let hostDiscordIdKick = parseDiscordId(parsedCommand.args[0])
          let playerDiscordIdKick = parseDiscordId(parsedCommand.args[1])

          if (hostDiscordIdKick === null) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "Sir, that host id is invalid."
            )
          }
          if (playerDiscordIdKick === null) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "Sir, that player id is invalid."
            )
          }

          UserAPI.findByDiscord(hostDiscordIdKick).then(hostUser => {
            UserAPI.findByDiscord(playerDiscordIdKick).then(playerUser => {
              let hostLobby = lobbies.getLobbyForHostSafe(leagueChannel, hostUser.steam)
              if (hostLobby === null) {
                MessagingAPI.sendToChannelWithMention(
                  message.channel.id,
                  message.author.id,
                  "Sir, that person is not hosting a lobby currently."
                )
                return 0
              }
              if (hostUser.steam === playerUser.steam) {
                MessagingAPI.sendToChannelWithMention(
                  message.channel.id,
                  message.author.id,
                  "Sir, you can not kick the host from their own lobby. Use `!admincancel [@host]` instead."
                )
                return 0
              }

              lobbies.removePlayerFromLobby(
                leagueChannel,
                hostUser.steam,
                playerUser.steam
              )
              let kickUserName = message.client.users.find(
                "id",
                playerUser.discord
              )
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "kicked " +
                  kickUserName +
                  " from <@" +
                  hostUser.discord +
                  "> @" +
                  hostLobby.region +
                  " region lobby. `(" +
                  lobbies.getLobbyForHostSafe(leagueChannel, hostUser.steam).players
                    .length +
                  "/8)`"
              )
              MessagingAPI.sendDM(
                playerUser.discord,
                "<#" +
                  message.channel.id +
                  "> An admin kicked you from <@" +
                  hostUser.discord +
                  "> @" +
                  hostLobby.region +
                  " region lobby."
              )
            })
          })
        })()
        break
      case "host":
        (function() {
          if (user === null) {
          }

          if (disableLobbyCommands === true) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              botDownMessage
            )
            return 0
          }
          if (disableLobbyHost === true) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "Lobby hosting disabled. Bot is going down for maintenance."
            )
          }

          let hostLobbyExist = lobbies.getLobbyForHostSafe(leagueChannel, user.steam)

          if (hostLobbyExist !== null) {
            MessagingAPI.sendToChannelWithMention(
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
              MessagingAPI.sendToChannelWithMention(
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
            MessagingAPI.sendToChannelWithMention(
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
            rankRequirement = parseRank(parsedCommand.args[1])

            if (rankRequirement === null) {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Invalid rank requirement. Example: `!host " +
                  region.toLowerCase() +
                  " bishop-1`. (no spaces in rank)"
              )
              return 0
            }
          } else if (parsedCommand.args.length > 2) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "Invalid arguments. Must be `!host [" +
                validRegions.join(", ").toLowerCase() +
                "]` [rank-1]`. Example: `!host na bishop-1`. (no spaces in rank)"
            )
            return 0
          }

          if (!validRegions.includes(region)) {
            MessagingAPI.sendToChannelWithMention(
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
              MessagingAPI.sendToChannelWithMention(
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
              MessagingAPI.sendToChannelWithMention(
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
              MessagingAPI.sendToChannelWithMention(
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
              MessagingAPI.sendToChannelWithMention(
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
            let newLobby = lobbies.createLobby(
              leagueChannel,
              user.steam,
              region,
              rankRequirement,
              token
            )

            // let currentLobby = getLobbyForPlayer(leagueChannel, user.steam);

            MessagingAPI.sendToChannelWithMention(
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
            MessagingAPI.sendDM(
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
        })()
        break
      case "start":
        (function() {
          if (disableLobbyCommands === true) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              botDownMessage
            )
            return 0
          }

          // check 8/8 then check all ranks, then send passwords
          let lobby = lobbies.getLobbyForHostSafe(leagueChannel, user.steam)

          if (lobby === undefined || lobby === null) {
            MessagingAPI.sendDM(
              message.author.id,
              "You are not hosting any lobbies in <#" + message.channel.id + ">"
            )
            MessagingAPI.deleteMessage(message)
            return 0
          }

          if (parsedCommand.args.length > 0) {
            // TODO: DRY
            let force = parsedCommand.args[0]

            if (force !== "force") {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Invalid arguments"
              )
              return 0
            }
            if (lobby.players.length < 2) {
              MessagingAPI.sendToChannelWithMention(
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

                lobbies.deleteLobby(leagueChannel, user.steam)

                MessagingAPI.sendToChannelWithMention(
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
              UserAPI.findAllUsersWithSteamIdsIn(lobby.players).then(
                players => {
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

                    MessagingAPI.sendToChannelWithMention(
                      message.channel.id,
                      message.author.id,
                      "**@" +
                        lobby["region"] +
                        " region lobby started. Good luck!** " +
                        playerDiscordIds.join(" | ")
                    )
                    lobbies.deleteLobby(leagueChannel, user.steam)
                  })
                }
              )
            } else {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Not enough players to start yet. `(" +
                  lobby.players.length +
                  "/8)`"
              )
            }
          }
        })()
        break
      case "join":
        (function() {
          if (disableLobbyCommands === true) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              botDownMessage
            )
            return 0
          }

          let playerLobbyJoin = lobbies.getLobbyForPlayer(
            leagueChannel,
            user.steam
          )

          if (playerLobbyJoin !== null) {
            MessagingAPI.sendDM(
              message.author.id,
              "<#" +
                message.channel.id +
                "> \"" +
                message.content +
                "\": You are already in a lobby! Use `!leave` to leave."
            )
            MessagingAPI.deleteMessage(message)
            return 0
          }
          if (parsedCommand.args.length === 0) {
            if (leagueChannelRegion === null) {
              MessagingAPI.sendDM(
                message.author.id,
                "<#" +
                  message.channel.id +
                  "> \"" +
                  message.content +
                  "\": Need to specify a host or region to join."
              )
              MessagingAPI.deleteMessage(message)
              return 0
            } else {
              parsedCommand.args[0] = leagueChannelRegion
            }
          }

          RanksAPI.getRankFromSteamID(user.steam).then(rank => {
            if (rank === null) {
              MessagingAPI.sendDM(
                message.author.id,
                "<#" +
                  message.channel.id +
                  "> \"" +
                  message.content +
                  "\": I am having problems verifying your rank."
              )
              MessagingAPI.deleteMessage(message)
              return 0
            }
            let resultLobbyHostId = null

            if (validRegions.includes(parsedCommand.args[0].toUpperCase())) {
              let region = parsedCommand.args[0].toUpperCase()
              // find host with most users not over 8 and join.

              let lobbiesInLeagueChannel = lobbies.getLobbiesInChannel(
                leagueChannel
              )

              if (Object.keys(lobbiesInLeagueChannel).length === 0) {
                if (leagueChannelRegion !== null) {
                  MessagingAPI.sendToChannelWithMention(
                    message.channel.id,
                    message.author.id,
                    "There are no lobbies currently. Use `!host` or `!host " +
                      leagueChannelRegion.toLowerCase() +
                      "` to host one!"
                  )
                  return 0
                } else {
                  MessagingAPI.sendToChannelWithMention(
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
                          lobbiesInLeagueChannel[resultLobbyHostId].players
                            .length
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
                MessagingAPI.sendDM(
                  message.author.id,
                  "<#" +
                    message.channel.id +
                    "> \"" +
                    message.content +
                    "\": All lobbies full. Use `!host [region]` to host another lobby."
                )
                MessagingAPI.deleteMessage(message)
                return 0
              }

              if (resultLobbyHostId === null) {
                MessagingAPI.sendDM(
                  message.author.id,
                  "<#" +
                    message.channel.id +
                    "> \"" +
                    message.content +
                    "\": Host does not exist or you can not join any lobbies (Maybe they are all full? Use `!host [region]` to host a new lobby). Make sure you have the required rank or a lobby for that region exists. Use `!join [@host]` or `!join [region]`."
                )
                MessagingAPI.deleteMessage(message)
                return 0
              }
            }

            let userPromise = null

            if (resultLobbyHostId === null) {
              userPromise = UserAPI.findByDiscord(
                parseDiscordId(parsedCommand.args[0])
              )
            } else {
              userPromise = UserAPI.findOneBySteam(resultLobbyHostId)
            }

            userPromise.then(function(hostUser) {
              if (hostUser === null) {
                MessagingAPI.sendDM(
                  message.author.id,
                  "<#" +
                    message.channel.id +
                    "> \"" +
                    message.content +
                    "\": Host not found in database."
                )
                MessagingAPI.deleteMessage(message)
                return 0
              }
              if (
                !lobbies.hasHostedLobbyInChannel(leagueChannel, hostUser.steam)
              ) {
                MessagingAPI.sendDM(
                  message.author.id,
                  "<#" +
                    message.channel.id +
                    "> \"" +
                    message.content +
                    "\": Host not found. Use `!list` to see lobbies or `!host [region]` to start one!"
                )
                MessagingAPI.deleteMessage(message)
                return 0
              }

              let lobby = lobbies.getLobbyForHostSafe(leagueChannel, hostUser.steam)

              if (lobby.players.length === 8) {
                MessagingAPI.sendDM(
                  message.author.id,
                  "<#" +
                    message.channel.id +
                    "> \"" +
                    message.content +
                    "\": That Lobby is full. Use `!host [region]` to start another one."
                )
                MessagingAPI.deleteMessage(message)
                return 0
              }

              let rankUpdate = { rank: rank.mmr_level, score: rank.score }
              if (rank.score === null) delete rankUpdate["score"]
              user.update(rankUpdate)
              if (rank.mmr_level < leagueRequirements[leagueRole]) {
                MessagingAPI.sendDM(
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
                MessagingAPI.deleteMessage(message)
                return 0
              }
              if (rank.mmr_level < lobby["rankRequirement"]) {
                MessagingAPI.sendDM(
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
                MessagingAPI.deleteMessage(message)
                return 0
              }

              lobby.players.push(user.steam)
              lobby.lastactivity = Date.now()

              getSteamPersonaNames([user.steam]).then(personaNames => {
                MessagingAPI.sendToChannel(
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
                MessagingAPI.sendDM(
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
                MessagingAPI.sendDM(
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
                  MessagingAPI.sendToChannel(
                    message.channel.id,
                    "**@" +
                      lobby["region"] +
                      " Lobby is full! <@" +
                      hostUser.discord +
                      "> can start the game with `!start`.**",
                    false
                  )
                  MessagingAPI.sendDM(
                    hostUser.discord,
                    "**@" +
                      lobby["region"] +
                      " Lobby is full! You can start the game with `!start` in <#" +
                      message.channel.id +
                      ">.** \n(Only start the game if you have verified everyone in the game lobby. Use `!lobby` to see players.)"
                  )
                }
                MessagingAPI.deleteMessage(message)
              })
            })
          })
        })()
        break
      case "leave":
      case "quit":
        (function() {
          if (disableLobbyCommands === true) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              botDownMessage
            )
            return 0
          }

          let playerLobbyLeave = lobbies.getLobbyForPlayer(
            leagueChannel,
            user.steam
          )

          if (playerLobbyLeave === null) {
            MessagingAPI.sendDM(
              message.author.id,
              "<#" +
                message.channel.id +
                "> \"" +
                message.content +
                "\": You are not in any lobbies."
            )
            MessagingAPI.deleteMessage(message)
            return 0
          }
          if (playerLobbyLeave.host === user.steam) {
            MessagingAPI.sendDM(
              message.author.id,
              "<#" +
                message.channel.id +
                "> \"" +
                message.content +
                "\": Hosts should use `!cancel` instead of `!leave`."
            )
            MessagingAPI.deleteMessage(message)
            return 0
          }

          let hostDiscordQuitId = playerLobbyLeave["host"]
          UserAPI.findOneBySteam(hostDiscordQuitId).then(function(hostUser) {
            if (
              lobbies.removePlayerFromLobby(
                leagueChannel,
                hostUser.steam,
                user.steam
              )
            ) {
              getSteamPersonaNames([user.steam]).then(personaNames => {
                let numPlayersLeft = lobbies.getLobbyForHostSafe(
                  leagueChannel,
                  hostUser.steam
                ).players.length
                MessagingAPI.sendToChannel(
                  message.channel.id,
                  "<@" +
                    message.author.id +
                    "> \"" +
                    personaNames[user.steam] +
                    "\" _**left**_ <@" +
                    hostUser.discord +
                    "> @" +
                    playerLobbyLeave.region +
                    " region lobby. `(" +
                    numPlayersLeft +
                    "/8)`"
                )
                MessagingAPI.sendDM(
                  hostUser.discord,
                  "<@" +
                    message.author.id +
                    "> \"" +
                    personaNames[user.steam] +
                    "\" _**left**_ your @" +
                    playerLobbyLeave.region +
                    " region lobby in <#" +
                    message.channel.id +
                    ">. `(" +
                    numPlayersLeft +
                    "/8)`"
                )
                MessagingAPI.deleteMessage(message)
              })
            }
          })
        })()
        break
      case "kick":
        (function() {
          if (disableLobbyCommands === true) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              botDownMessage
            )
            return 0
          }

          let hostLobby = lobbies.getLobbyForHostSafe(leagueChannel, user.steam)

          if (hostLobby === null) {
            MessagingAPI.sendDM(
              message.author.id,
              "<#" +
                message.channel.id +
                "> \"" +
                message.content +
                "\": You are not hosting any lobbies in <#" +
                message.channel.id +
                ">"
            )
            MessagingAPI.deleteMessage(message)
            return 0
          }
          if (parsedCommand.args.length < 1) {
            MessagingAPI.sendDM(
              message.author.id,
              "<#" +
                message.channel.id +
                "> \"" +
                message.content +
                "\": You need to specify a player to kick: `!kick @quest`"
            )
            MessagingAPI.deleteMessage(message)
            return 0
          }
          let kickedPlayerDiscordId = parseDiscordId(parsedCommand.args[0])

          if (!message.guild.member(kickedPlayerDiscordId)) {
            MessagingAPI.sendDM(
              message.author.id,
              "<#" +
                message.channel.id +
                "> \"" +
                message.content +
                "\": Could not find that user on this server."
            )
            MessagingAPI.deleteMessage(message)
            return 0
          }
          UserAPI.findByDiscord(kickedPlayerDiscordId).then(function(
            kickedPlayerUser
          ) {
            if (kickedPlayerUser === null) {
              MessagingAPI.sendDM(
                message.author.id,
                "<#" +
                  message.channel.id +
                  "> \"" +
                  message.content +
                  "\": User not in database. Make sure to use mentions in command: `!kick @username`"
              )
              MessagingAPI.deleteMessage(message)
              return 0
            }
            if (hostLobby.players.length === 1) {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "You can not kick the last player."
              )
              return 0
            }
            if (hostLobby.host === kickedPlayerUser.steam) {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "You can not kick yourself. (Use !cancel to cancel a lobby you have hosted)"
              )
              return 0
            }
            if (!hostLobby.players.includes(kickedPlayerUser.steam)) {
              MessagingAPI.sendDM(
                message.author.id,
                "<#" +
                  message.channel.id +
                  "> \"" +
                  message.content +
                  "\": User not in lobby."
              )
              MessagingAPI.deleteMessage(message)
              return 0
            }

            if (
              lobbies.removePlayerFromLobby(
                leagueChannel,
                user.steam,
                kickedPlayerUser.steam
              )
            ) {
              let kickUserName = message.client.users.find(
                "id",
                kickedPlayerDiscordId
              )
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "kicked " +
                  kickUserName +
                  " from <@" +
                  user.discord +
                  "> @" +
                  hostLobby.region +
                  " region lobby. `(" +
                  lobbies.lobbies.getLobbyForHostSafe(leagueChannel, user.steam).players
                    .length +
                  "/8)`"
              )
              MessagingAPI.sendDM(
                kickedPlayerDiscordId,
                "<@" +
                  user.discord +
                  "> kicked you from their lobby in <#" +
                  message.channel.id +
                  ">."
              )
            }
          })
        })()
        break
      case "list":
      case "lobbies":
      case "games":
        (function() {
          if (disableLobbyCommands === true) {
            MessagingAPI.sendToChannelWithMention(
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
              MessagingAPI.sendDM(
                message.author.id,
                "<#" +
                  message.channel.id +
                  "> \"" +
                  message.content +
                  "\": This command is currently rate limited in <#" +
                  message.channel.id +
                  ">."
              )
              MessagingAPI.deleteMessage(message)
              // rate limited
              return 0
            }
          }

          let printFullList = false
          if (
            parsedCommand.args.length === 1 &&
            (parsedCommand.args[0] === "full" ||
              parsedCommand.args[0] === "all")
          ) {
            printFullList = true
          }

          listratelimit[leagueChannel] = Date.now()

          MessagingAPI.sendToChannel(
            message.channel.id,
            "**__LOBBY LIST__ - Use `!lobby` to display players in your own lobby**"
          )

          let lobbiesInLeagueChannel = lobbies.getLobbiesInChannel(
            leagueChannel
          )
          for (let hostId in lobbiesInLeagueChannel) {
            if (lobbiesInLeagueChannel.hasOwnProperty(hostId)) {
              let lobby = lobbiesInLeagueChannel[hostId]
              if (lobby.host !== null && lobby.password !== null) {
                UserAPI.findAllUsersWithSteamIdsIn(lobby.players).then(
                  players => {
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
                          (Date.now() - new Date(lobby.lastactivity)) /
                            1000 /
                            60
                        )
                        if (lastActivity >= 2) {
                          lastActivityStr =
                            " (" + lastActivity + "m last activity)"
                        }
                        if (
                          !dontPrint &&
                          lastActivity > 15 &&
                          !exemptLeagueRolePruning.includes(leagueRole)
                        ) {
                          lobbies.deleteLobby(leagueChannel, lobby.host)
                          dontPrint = true
                          MessagingAPI.sendToChannel(
                            message.channel.id,
                            "_*** @" +
                              lobby.region +
                              " <@" +
                              hostDiscordId +
                              "> lobby has been removed because of no activity (joins/leaves) for more than 15 minutes._"
                          )
                          MessagingAPI.sendDM(
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
                          lobbies.deleteLobby(leagueChannel, lobby.host)
                          dontPrint = true
                          MessagingAPI.sendToChannel(
                            message.channel.id,
                            "_*** @" +
                              lobby.region +
                              " <@" +
                              hostDiscordId +
                              "> lobby has been removed because it is full and has had no activity (joins/leaves) for more than 5 minutes._"
                          )
                          MessagingAPI.sendDM(
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
                        lobbies.deleteLobby(leagueChannel, lobby.host)
                        dontPrint = true
                        MessagingAPI.sendToChannel(
                          message.channel.id,
                          "_*** @" +
                            lobby.region +
                            " <@" +
                            hostDiscordId +
                            "> lobby has been removed because it has not started after 60 minutes._"
                        )
                        MessagingAPI.sendDM(
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
                          MessagingAPI.sendToChannel(
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
                          MessagingAPI.sendToChannel(
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
                  }
                )
              }
            }
            numPrinted++
          }
          if (numPrinted === 0) {
            if (leagueChannelRegion !== null) {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "There are no lobbies currently. Use `!host` or `!host " +
                  leagueChannelRegion.toLowerCase() +
                  "` to host one!"
              )
              return 0
            } else {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "There are no lobbies for that region currently. Use `!host [region]` to host one!"
              )
              return 0
            }
          }
        })()
        break
      case "lobby":
        (function() {
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
            let lobby = lobbies.getLobbyForPlayer(leagueChannel, hostUser.steam)

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
              UserAPI.findAllUsersWithSteamIdsIn(lobby.players).then(
                players => {
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
                        Math.round(
                          (Date.now() - new Date(lobby.starttime)) / 1000 / 60
                        ) +
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
                        Math.round(
                          (Date.now() - new Date(lobby.starttime)) / 1000 / 60
                        ) +
                        "m)" +
                        lastActivityStr
                    )
                    MessagingAPI.deleteMessage(message)
                  })
                }
              )
            }
          })
        })()
        break
      case "cancel":
      case "close":
      case "end":
      case "unhost":
        // TODO: DM all players if a lobby they were in was cancelled?
        (function() {
          if (disableLobbyCommands === true) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              botDownMessage
            )
            return 0
          }

          let hostLobbyEnd = lobbies.getLobbyForHostSafe(leagueChannel, user.steam)

          if (hostLobbyEnd === null) {
            MessagingAPI.sendDM(
              message.author.id,
              "<#" +
                message.channel.id +
                "> \"" +
                message.content +
                "\": You are not hosting any lobbies in <#" +
                message.channel.id +
                ">"
            )
            MessagingAPI.deleteMessage(message)
            return 0
          }
          let regionEnd = hostLobbyEnd["region"]

          if (lobbies.isHostOfHostedLobby(leagueChannel, user.steam)) {
            lobbies.deleteLobby(leagueChannel, user.steam)
            MessagingAPI.sendToChannel(
              message.channel.id,
              "<@" +
                user.discord +
                "> @" +
                regionEnd +
                " region **lobby cancelled**."
            )
            return 0
          }
        })()
        break
      case "getpassword":
      case "password":
      case "pass":
      case "sendpassword":
      case "sendpass":
        (function() {
          if (disableLobbyCommands === true) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              botDownMessage
            )
            return 0
          }

          let playerSendPassLobby = lobbies.getLobbyForPlayer(
            leagueChannel,
            user.steam
          )

          if (playerSendPassLobby === null) {
            MessagingAPI.sendDM(
              message.author.id,
              "<#" +
                message.channel.id +
                "> \"" +
                message.content +
                "\": You are not in any lobbies."
            )
            MessagingAPI.deleteMessage(message)
            return 0
          }

          UserAPI.findOneBySteam(playerSendPassLobby.host).then(function(
            hostUser
          ) {
            if (hostUser === null) {
              MessagingAPI.sendDM(
                message.author.id,
                "<#" +
                  message.channel.id +
                  "> \"" +
                  message.content +
                  "\": Host not found in database."
              )
              MessagingAPI.deleteMessage(message)
              return 0
            }
            if (
              !lobbies.hasHostedLobbyInChannel(leagueChannel, hostUser.steam)
            ) {
              MessagingAPI.sendDM(
                message.author.id,
                "<#" +
                  message.channel.id +
                  "> \"" +
                  message.content +
                  "\": Host not found. Use `!list` to see lobbies or `!host [region]` to start one!"
              )
              MessagingAPI.deleteMessage(message)
              return 0
            }

            let lobby = lobbies.getLobbyForHostSafe(leagueChannel, hostUser.steam)
            MessagingAPI.sendDM(
              message.author.id,
              "<#" +
                message.channel.id +
                "> \"" +
                message.content +
                "\": Lobby password for <@" +
                hostUser.discord +
                "> " +
                lobby["region"] +
                " region: `" +
                lobby["password"] +
                "`. Please join this lobby in Dota 2 Custom Games. If you cannot find the lobby, whisper the host on Discord to create it <@" +
                hostUser.discord +
                ">."
            )
            MessagingAPI.deleteMessage(message)
          })
        })()
        break
      default:
        (function() {
          // MessagingAPI.sendToChannelWithMention(message.channel.id, message.author.id, "Unhandled bot message: " + message.content);
          // console.log("Unhandled bot message for lobby: " + message.content);
          isLobbyCommand = false
        })()
    }
  }

  let isBotCommand = true

  switch (parsedCommand.command) {
    case "adminrestartbot":
    case "restartbot":
    case "suicide":
    case "killyourself":
    case "die":
    case "getouttahere":
    case "seppuku":
      (function() {
        if (
          !message.member.roles.has(
            message.guild.roles.find(r => r.name === adminRoleName).id
          )
        )
          return 0
        disableLobbyCommands = true

        lobbies.backupLobbies(logger)

        let famousLastWords = [
          "Hey fellas! How about this for a headline for tomorrow’s paper? ‘French fries.'",
          "What the devil do you mean to sing to me, priest? You are out of tune.",
          "Good. A woman who can fart is not dead.",
          "I’d hate to die twice. It’s so boring.",
          "I did not get my Spaghetti-O’s; I got spaghetti. I want the press to know this.",
          "I’d like to thank the Academy for my lifetime achievement award that I will eventually get.",
          "I knew it! I knew it! Born in a hotel room and, goddamn it, dying in a hotel room.",
          "And now for a final word from our sponsor—.",
          "Remember, Honey, don’t forget what I told you. Put in my coffin a deck of cards, a mashie niblick, and a pretty blonde.",
          "Damn it! Don’t you dare ask God to help me!",
          "Yeah, country music.",
          "Bring me a bullet-proof vest.",
          "Surprise me.",
          "Thank god. I’m tired of being the funniest person in the room.",
          "I’ve had 18 straight whiskeys... I think that’s the record.",
          "They couldn’t hit an elephant at this dist—",
          "On the contrary.",
          "I should have never switched from scotch to martinis.",
          "I am sorry to bother you chaps. I don’t know how you get along so fast with the traffic on the roads these days.",
          "Now is not the time for making new enemies.",
          "I’m looking for loopholes.",
          "This wallpaper and I are fighting a duel to the death. Either it goes or I do.",
          "Gun’s not loaded… see?",
          "Am I dying, or is this my birthday?",
          "Oh, you young people act like old men. You have no fun.",
          "Codeine... bourbon...",
          "No.",
          "I’m bored with it all.",
          "This is no way to live.",
          "I desire to go to Hell and not to Heaven. In the former I shall enjoy the company of popes, kings and princes, while in the latter are only beggars, monks and apostles.",
          "Turn me over — I’m done on this side.",
          "Now why did I do that?",
          "Don’t let it end like this. Tell them I said something important.",
          // "Oh Lord, forgive the misprints!",
          // "All right, then, I’ll say it: Dante makes me sick.",
          "I'll be back!",
          "Yes, master.",
          "Sentences are the building blocks of paragraphs.",
          "Beep boop, I am a robot. Haha just kidding!",
          "Sometimes it's better to remain silent and be thought a fool, rather than open your mouth and remove all doubt.",
          "Mitochondria is the powerhouse of the cell",
          "Beep boop, I am a :pepega: Haha not kidding :pepega:"
        ]
        MessagingAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          famousLastWords[Math.floor(Math.random() * famousLastWords.length)]
        )
        setTimeout(function() {
          process.exit(1)
        }, 1000)
      })()
      break
    case "admindisablebot":
    case "disablebot":
      (function() {
        if (
          !message.member.roles.has(
            message.guild.roles.find(r => r.name === adminRoleName).id
          )
        )
          return 0

        if (disableLobbyCommands === false) {
          disableLobbyCommands = true

          lobbies.backupLobbies(logger)
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, lobby commands disabled. Lobby data saved."
          )
          return 0
        } else {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, I am not enabled!"
          )
        }
      })()
      break
    case "adminenablebot":
    case "enablebot":
      (function() {
        if (message.author.id !== "204094307689431043") {
          return 0 // no permissions
        }
        if (disableLobbyCommands === true) {
          disableLobbyCommands = false

          lobbies.restoreLobbiesSafe()
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, Lobby data loaded. Lobby commands enabled."
          )
          return 0
        } else {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, I am not disabled."
          )
        }
      })()
      break
    case "admintogglehost":
    case "togglehost":
      (function() {
        if (
          !message.member.roles.has(
            message.guild.roles.find(r => r.name === adminRoleName).id
          )
        )
          return 0

        if (disableLobbyHost === true) {
          disableLobbyHost = false
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, lobby hosting enabled."
          )
        } else {
          disableLobbyHost = true
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, lobby hosting disabled."
          )
        }
      })()
      break
    case "adminsavelobbies":
    case "savelobbies":
      (function() {
        if (message.author.id !== "204094307689431043") {
          return 0 // no permissions
        }
        lobbies.backupLobbies(logger)
        MessagingAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "Sir, lobby data saved."
        )
      })()
      break
    case "adminlobbyinfo":
    case "lobbyinfo":
      (function() {
        if (
          !message.member.roles.has(
            message.guild.roles.find(r => r.name === adminRoleName).id
          )
        )
          return 0

        MessagingAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "disableLobbyCommands: " +
            disableLobbyCommands +
            ", " +
            "disableLobbyHost: " +
            disableLobbyHost
        )
        // add lobby sizes
      })()
      break
    case "adminclearlobbies":
    case "clearlobbies":
      (function() {
        if (
          !message.member.roles.has(
            message.guild.roles.find(r => r.name === adminRoleName).id
          )
        )
          return 0

        if (parsedCommand.args.length !== 1) {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, invalid argument, try: `!adminclearlobbies " +
              leagueRoles.join(", ") +
              "`."
          )
          return 0
        }
        let role = parsedCommand.args[0]

        if (!leagueRoles.includes(role)) {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, invalid League, try:" + leagueRoles.join(", ")
          )
        }

        lobbies.resetLobbies(role)
        MessagingAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "Sir, I cleared " + role + " lobbies."
        )

        lobbies.backupLobbies(logger)
      })()
      break
    case "addlobby":
      (function() {
        if (message.author.id !== "204094307689431043") return 0 // no permissions

        lobbies.resetLobbies(parsedCommand.args[0])
        MessagingAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "OK."
        )
      })()
      break
    case "removelobby":
      (function() {
        if (message.author.id !== "204094307689431043") {
          return 0 // no permissions
        }

        lobbies.removeLobbies(parsedCommand.args[0])
        MessagingAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "OK."
        )
      })()
      break
    case "adminupdateroles":
      (function() {
        if (
          !message.member.roles.has(
            message.guild.roles.find(r => r.name === adminRoleName).id
          )
        )
          return 0

        if (message.channel.type === "dm") {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, I can not update roles in direct messages. Please try in a channel on the server."
          )
          return 0
        }
        if (parsedCommand.args.length < 1) {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, the command is `!adminlink [@discord] [[steamid]]`"
          )
          return 0
        }
        let updateRolePlayerDiscordId = parseDiscordId(parsedCommand.args[0])

        UserAPI.findByDiscord(updateRolePlayerDiscordId).then(function(
          playerUser
        ) {
          if (playerUser === null) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "Sir, I could not find that user."
            )
            return 0
          }
          updateRoles(message, playerUser, true, true)
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, trying to update roles for <@" + playerUser.discord + ">."
          )
        })
      })()
      break
    case "admincreatelink":
      (function() {
        if (
          !message.member.roles.has(
            message.guild.roles.find(r => r.name === adminRoleName).id
          )
        )
          return 0

        if (parsedCommand.args.length < 1) {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, the command is `!adminlink [@discord] [[steamid]]`"
          )
          return 0
        }
        let createLinkPlayerDiscordId = parseDiscordId(parsedCommand.args[0])
        let forceSteamIdLink = parsedCommand.args[1]

        UserAPI.findByDiscord(createLinkPlayerDiscordId).then(function(
          linkPlayerUser
        ) {
          if (linkPlayerUser === null) {
            UserAPI.create({
              discord: createLinkPlayerDiscordId,
              steam: forceSteamIdLink,
              validated: false
            })
              .then(() => {
                MessagingAPI.sendToChannelWithMention(
                  message.channel.id,
                  message.author.id,
                  "Sir, I have linked <@" +
                    createLinkPlayerDiscordId +
                    "> steam id `" +
                    forceSteamIdLink +
                    "`. Remember they will not have any roles. Use `!adminupdateroles [@discord]`."
                )
              })
              .catch(function(msg) {
                logger.error("error " + msg)
              })
          } else {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "Sir, <@" +
                createLinkPlayerDiscordId +
                "> is already linked to steam id `" +
                linkPlayerUser.steam +
                "`. Use `!adminupdatelink [@discord] [steam]` instead."
            )
            return 0
          }
        })
      })()
      break
    case "adminunlink":
      (function() {
        if (
          !message.member.roles.has(
            message.guild.roles.find(r => r.name === adminRoleName).id
          )
        )
          return 0

        if (parsedCommand.args.length !== 1) {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, the command is `!adminunlink [@discord]`"
          )
          return 0
        }
        let unlinkPlayerDiscordId = parseDiscordId(parsedCommand.args[0])

        UserAPI.findByDiscord(unlinkPlayerDiscordId).then(function(
          unlinkPlayerUser
        ) {
          let oldSteamID = unlinkPlayerUser.steam
          unlinkPlayerUser.update({ steam: null, validated: false }).then(
            function(result) {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Sir, I have unlinked <@" +
                  unlinkPlayerUser.discord +
                  ">'s steam id. `" +
                  oldSteamID +
                  "`"
              )
            },
            function(error) {
              logger.error(error)
            }
          )
        })
      })()
      break
    case "adminunlinksteam":
      (function() {
        if (
          !message.member.roles.has(
            message.guild.roles.find(r => r.name === adminRoleName).id
          )
        )
          return 0

        if (parsedCommand.args.length !== 1) {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, the command is `!adminunlink [steamid]`"
          )
          return 0
        }
        if (!parseInt(parsedCommand.args[0])) {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, that is an invalid steam id"
          )
          return 0
        }
        let unlinkPlayerSteamId = parsedCommand.args[0]
        VerifiedSteamAPI.findOneBySteam(unlinkPlayerSteamId).then(
          verifiedSteam => {
            if (verifiedSteam !== null) {
              verifiedSteam
                .destroy()
                .then(() =>
                  MessagingAPI.sendToChannelWithMention(
                    message.channel.id,
                    message.author.id,
                    `Sir, I have removed verified steam id record for \`${unlinkPlayerSteamId}\``
                  )
                )
            }
          }
        )

        UserAPI.findAllBySteam(unlinkPlayerSteamId).then(function(
          unlinkPlayerUsers
        ) {
          unlinkPlayerUsers.forEach(unlinkPlayerUser => {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "Sir, I have unlinked <@" +
                unlinkPlayerUser.discord +
                ">'s steam id."
            )
            unlinkPlayerUser.update({ steam: null, validated: false })
          })
        })
      })()
      break
    case "admingetsteam":
    case "getsteam":
    case "gets":
      (function() {
        if (
          !message.member.roles.has(
            message.guild.roles.find(r => r.name === adminRoleName).id
          )
        )
          return 0

        if (parsedCommand.args.length !== 1) {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, the command is `!admingetsteam [@discord]`"
          )
          return 0
        }
        let infoPlayerDiscordId = parseDiscordId(parsedCommand.args[0])

        if (infoPlayerDiscordId === null) {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, that is an invalid Discord ID. Make sure it is a mention (blue text)."
          )
          return 0
        }

        UserAPI.findUserAndVerifiedSteamsByDiscord(infoPlayerDiscordId).then(
          function(infoPlayerUser) {
            if (infoPlayerUser === null) {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Sir, I did not find any matches in database for <@" +
                  infoPlayerDiscordId +
                  ">"
              )
              return 0
            }
            if (infoPlayerUser.steam === null) {
              MessagingAPI.sendToChannelWithMention(
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
              MessagingAPI.sendToChannelWithMention(
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
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              `Sir, <@${
                infoPlayerUser.discord
              }> is linked to steam id: ${verifiedSteams}.`
            )
          }
        )
      })()
      break
    case "admingetdiscord":
    case "getdiscord":
    case "getd":
      (function() {
        if (
          !message.member.roles.has(
            message.guild.roles.find(r => r.name === adminRoleName).id
          )
        )
          return 0

        if (parsedCommand.args.length !== 1) {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Sir, the command is `!admingetdiscord [steam]`"
          )
          return 0
        }
        const steamId = parsedCommand.args[0]

        if (!parseInt(steamId)) {
          MessagingAPI.sendToChannelWithMention(
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
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "Sir, I found these users for `" +
                steamId +
                "`: " +
                playerDiscordIds.join(", ") +
                "."
            )
          } else {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "Sir, I did not find any matches in database for `" +
                steamId +
                "`."
            )
          }
        })
      })()
      break
    case "verificationstats":
    case "vstats":
      (function() {
        if (
          !message.member.roles.has(
            message.guild.roles.find(r => r.name === adminRoleName).id
          )
        )
          return 0
        if (message.channel.type !== "dm") {
          UserAPI.getVerificationStats().then(count => {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              `Sir, ${count} users have verified their steam accounts.`
            )
            return 0
          })
        }
      })()
      break
    case "setactivetournament":
      (function() {
        if (message.author.id !== "204094307689431043") return 0 // no permissions

        if (parsedCommand.args.length !== 1) {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "!setactivetournament [id]"
          )
        }

        activeTournament = parsedCommand.args[0]
      })()
      break
    case "createtournament":
      (function() {
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
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Created!"
          )
        })
      })()
      break
    case "admintournamentlist":
      (function() {
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
              MessagingAPI.sendToChannel(
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
      })()
      break
    case "register":
      (function() {
        if (message.channel.name === "tournament-signups") {
          if (user.validated !== true) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "You must have a verified account in order to register for tournaments. See <#" +
                client.channels.find(r => r.name === "readme").id +
                "> for instructions."
            )
            return 0
          }

          TournamentAPI.findRegistration({
            fk_tournament: activeTournament,
            steam: user.steam
          }).then(result => {
            if (result !== null) {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "That steam id has already been registered in this tournament. Information:\nDate: `" +
                  new Date(parseInt(result.date)).toString() +
                  "`\nDiscord: <@" +
                  result.discord +
                  ">\nSteam ID: `" +
                  result.steam +
                  "`\nRank: " +
                  RanksAPI.getRankString(result.rank) +
                  "\nMMR: `" +
                  result.score +
                  "`\nPreferred Region: `" +
                  result.region +
                  "`\nCountry: " +
                  result.country
              )
              return 0
            }

            if (parsedCommand.args.length < 2) {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Invalid arguments. Must be `!register [" +
                  validRegions.join(", ").toLowerCase() +
                  "] [:flag_ca:, :flag_us:, ...]`"
              )
              return 0
            }

            let region = parsedCommand.args[0].toUpperCase()

            if (!validRegions.includes(region)) {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Invalid arguments. Must be `!register [" +
                  validRegions.join(", ").toLowerCase() +
                  "] [:flag_ca:, :flag_us:, ...]`"
              )
              return 0
            }

            let country = parsedCommand.args[1].toUpperCase()
            if (country.length !== 4) {
              // emoji utf-8 character for flag
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Invalid arguments. Must be `!register [" +
                  validRegions.join(", ").toLowerCase() +
                  "] [:flag_ca:, :flag_us:, ...]`"
              )
              return 0
            }

            TournamentAPI.createRegistration({
              fk_tournament: activeTournament,
              discord: user.discord,
              steam: user.steam,
              rank: user.rank,
              score: user.score,
              date: Date.now(),
              region: region,
              country: country
            }).then(registration => {
              TournamentAPI.getTournament(registration.fk_tournament).then(
                tournament => {
                  MessagingAPI.sendToChannelWithMention(
                    message.channel.id,
                    message.author.id,
                    "Successfully registered you for the " +
                      tournament.name +
                      "! I have recorded your rank " +
                      RanksAPI.getRankString(registration.rank) +
                      " and MMR `" +
                      registration.score +
                      "` on `" +
                      new Date(parseInt(registration.date)).toString() +
                      "` with Steam ID: `" +
                      registration.steam +
                      "`. Your preferred region is `" +
                      registration.region +
                      "`. Your country is " +
                      registration.country +
                      "."
                  )
                }
              )
            })
          })
        }
      })()
      break
    case "unregister":
      (function() {
        if (message.channel.name === "tournament-signups") {
          TournamentAPI.findRegistration({
            fk_tournament: activeTournament,
            steam: user.steam
          }).then(result => {
            if (result !== null) {
              result.destroy().then(success => {
                MessagingAPI.sendToChannelWithMention(
                  message.channel.id,
                  message.author.id,
                  "I have unregistered you for the current tournament."
                )
                return 0
              })
            } else {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "You have not registered for the current tournament yet."
              )
              return 0
            }
          })
        }
      })()
      break
    case "adminunregister":
      (function() {
        if (message.author.id !== "204094307689431043") return 0 // no permissions

        let discordUser = parseDiscordId(parsedCommand.args[0])

        TournamentAPI.findRegistration({ discord: discordUser }).then(
          registration => {
            registration.destroy().then(deleted => {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Sir, I deleted that tournament registration by <@" +
                  deleted.discord +
                  ">"
              )
            })
          }
        )
      })()
      break
    case "getrank":
    case "checkrank":
    case "rank":
      (function() {
        if (parsedCommand.args.length === 1) {
          let getRankUserDiscordId = parseDiscordId(parsedCommand.args[0])

          if (getRankUserDiscordId !== null) {
            if (!message.guild.member(getRankUserDiscordId)) {
              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Could not find that user on this server."
              )
              return 0
            }
            UserAPI.findByDiscord(getRankUserDiscordId).then(getRankUser => {
              if (getRankUser === null || getRankUser.steam === null) {
                MessagingAPI.sendToChannelWithMention(
                  message.channel.id,
                  message.author.id,
                  "That user has not linked a steam id yet."
                )
                return 0
              }
              RanksAPI.getRankFromSteamID(getRankUser.steam).then(rank => {
                if (rank === null) {
                  MessagingAPI.sendToChannelWithMention(
                    message.channel.id,
                    message.author.id,
                    "I am having problems verifying your rank."
                  )
                  return 0
                }

                let MMRStr = ""
                if (rank.score !== null) {
                  MMRStr = " MMR is: `" + rank.score + "`."
                }
                let verificationStatus =
                  getRankUser.validated === true
                    ? "[✅ Verified] "
                    : `[❌ Follow instructions in <#${
                      client.channels.find(r => r.name === "readme").id
                    }> to verify] `

                MessagingAPI.sendToChannelWithMention(
                  message.channel.id,
                  message.author.id,
                  verificationStatus +
                    "Current rank for <@" +
                    getRankUser.discord +
                    "> is: " +
                    RanksAPI.getRankString(rank.mmr_level) +
                    "." +
                    MMRStr
                )

                if (leagueLobbies.includes(message.channel.name)) {
                  MessagingAPI.deleteMessage(message)
                }
                return 0
              })
            })
          } else if (parseInt(parsedCommand.args[0])) {
            let publicSteamId = parsedCommand.args[0]

            RanksAPI.getRankFromSteamID(publicSteamId).then(rank => {
              if (rank === null) {
                MessagingAPI.sendToChannelWithMention(
                  message.channel.id,
                  message.author.id,
                  "I am having problems verifying your rank."
                )
                return 0
              }

              let MMRStr = ""
              if (rank.score !== null) {
                MMRStr = " MMR is: `" + rank.score + "`."
              }

              if (user.steam === publicSteamId) {
                //todo remind about people they can just use !rank with no param
              }

              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                "Current rank for " +
                  publicSteamId +
                  " is: " +
                  RanksAPI.getRankString(rank.mmr_level) +
                  "." +
                  MMRStr
              )

              if (leagueLobbies.includes(message.channel.name)) {
                MessagingAPI.deleteMessage(message)
              }
              return 0
            })
          } else {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "Invalid arguments."
            )
          }
        } else {
          if (
            user !== null &&
            user.steam !== null &&
            user.steamLinkToken === null
          ) {
            RanksAPI.getRankFromSteamID(user.steam).then(rank => {
              if (rank === null) {
                MessagingAPI.sendToChannelWithMention(
                  message.channel.id,
                  message.author.id,
                  "I am having problems verifying your rank."
                )
                return 0
              }

              let MMRStr = ""
              if (rank.score !== null) {
                MMRStr = " MMR is: `" + rank.score + "`. "
              }

              let verificationStatus =
                user.validated === true
                  ? "[✅ Verified] "
                  : `[❌ Follow instructions in <#${
                    client.channels.find(r => r.name === "readme").id
                  }> to verify] `

              MessagingAPI.sendToChannelWithMention(
                message.channel.id,
                message.author.id,
                verificationStatus +
                  "Your current rank is: " +
                  RanksAPI.getRankString(rank.mmr_level) +
                  "." +
                  MMRStr
              )
              let rankUpdate = { rank: rank.mmr_level, score: rank.score }
              if (rank.score === null) delete rankUpdate["score"]
              user.update(rankUpdate).then(nothing => {
                if (leagueLobbies.includes(message.channel.name)) {
                  updateRoles(message, nothing, false, false, true)
                } else {
                  updateRoles(message, nothing, false, false, false)
                }
              })
            })
          } else {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              `You have not linked a steam id. Follow instructions in <#${
                client.channels.find(r => r.name === "readme").id
              }> to verify.`
            )
          }
        }
      })()
      break
    case "removerole":
      (function() {
        // TODO;
      })()
      break
    case "getsteampersona":
    case "steampersona":
    case "getp":
      (function() {
        if (parsedCommand.args.length === 1) {
          let getSteamPersonaUserDiscordId = parseDiscordId(
            parsedCommand.args[0]
          )

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
                getSteamPersonaNames([getSteamPersonaUser.steam]).then(
                  personas => {
                    MessagingAPI.sendToChannelWithMention(
                      message.channel.id,
                      message.author.id,
                      "<@" +
                        getSteamPersonaUser.discord +
                        "> Steam Name is \"" +
                        personas[getSteamPersonaUser.steam] +
                        "\""
                    )
                  }
                )
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
      })()
      break
    case "updateroles":
    case "updaterole":
    case "updateranks":
    case "udpaterank":
    case "roles":
    case "role":
      (function() {
        if (message.channel.type === "dm") {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "I can not update roles in direct messages. Please try in <#542465986859761676>."
          )
          return 0
        }
        if (leagueLobbies.includes(message.channel.name)) {
          updateRoles(message, user, true, true, true)
        } else {
          updateRoles(message, user, true, true, false)
        }
      })()
      break
    case "help":
      (function() {
        MessagingAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "See <#542454956825903104> for more information."
        )
      })()
      break
    case "staffhelp":
    case "shelp":
    case "sh":
      (function() {
        if (parsedCommand.args.length === 0) {
          MessagingAPI.sendDM(
            message.author.id,
            "Sir, the command is !staffhelp [@discord] [topic] [[language]]."
          )
          MessagingAPI.deleteMessage(message)
          return 0
        }
        let staffHelpUserDiscordId = parseDiscordId(parsedCommand.args[0])
        if (staffHelpUserDiscordId === null) {
          MessagingAPI.sendDM(
            message.author.id,
            "Sir, that is an invalid Discord ID.  Make sure it is a mention (blue text)."
          )
          MessagingAPI.deleteMessage(message)
          return 0
        }

        if (staffHelpUserDiscordId !== null) {
          if (!message.guild.member(staffHelpUserDiscordId)) {
            MessagingAPI.sendDM(
              message.author.id,
              "Sir, I could not find that user on this server."
            )
            MessagingAPI.deleteMessage(message)
            return 0
          }
        }

        let lang = parsedCommand.args[2]
        if (lang === null) {
          lang = "en"
        }

        let topic = parsedCommand.args[1]
        let helptext = ""

        switch (topic) {
          case "tony":
            helptext = {
              en:
                "Tony is a pepega, don't complain about losing if you go him.",
              ru: "Russian here"
            }[lang]
            break
          default:
            MessagingAPI.sendDM(
              message.author.id,
              "Could not find that help topic."
            )
            MessagingAPI.deleteMessage(message)
            return 0
        }

        MessagingAPI.sendToChannelWithMention(
          message.channel.id,
          staffHelpUserDiscordId,
          helptext
        )
      })()
      break
    default:
      (function() {
        isBotCommand = false
      })()
  }

  if (isBotCommand === false && message.channel.type !== "dm") {
    // This means the command was a lobby command.
    if (
      isLobbyCommand === null &&
      !leagueLobbies.includes(message.channel.name)
    ) {
      MessagingAPI.sendDM(
        message.author.id,
        "<#" +
          message.channel.id +
          "> \"" +
          message.content +
          "\": You can not use lobby commands in this channel."
      )
      MessagingAPI.deleteMessage(message)
      return 0
    }
    if (isLobbyCommand === false) {
      logger.info("Unhandled bot message: " + message.content)
      MessagingAPI.sendDM(
        message.author.id,
        "<#" +
          message.channel.id +
          "> \"" +
          message.content +
          "\": I was not able to process this command. Please read <#542454956825903104> for command list. Join <#542494966220587038> for help from staff."
      )
      MessagingAPI.deleteMessage(message)
      return 0
    }
  }
}

module.exports = switchCase
