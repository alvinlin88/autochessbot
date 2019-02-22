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

const register = ({ parsedCommand, user, message }) => {
  if (message.channel.name === "tournament-signups") {
    if (user.validated !== true) {
      MessagesAPI.sendToChannelWithMention(
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
        MessagesAPI.sendToChannelWithMention(
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
        MessagesAPI.sendToChannelWithMention(
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
        MessagesAPI.sendToChannelWithMention(
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
        MessagesAPI.sendToChannelWithMention(
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
            MessagesAPI.sendToChannelWithMention(
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
}

module.exports = {
  function: register,
  isAdmin: false,
  scopes: ["tournament"]
}
