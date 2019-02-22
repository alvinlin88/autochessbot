const client = require("../../helpers/client")
const MessagesAPI = require("../../helpers/MessagesAPI")
const RanksAPI = require("../../helpers/RanksAPI")
const {
  leagueLobbies
} = require("../../constants/leagues")
const UserAPI = require("../../helpers/UserAPI")
const parseDiscordId = require("../../helpers/discord/parseDiscordID")
const processRolesUpdate = require("../../helpers/processRolesUpdate")

const rank = ({ parsedCommand, user, message }) => {
  if (parsedCommand.args.length === 1) {
    let getRankUserDiscordId = parseDiscordId(parsedCommand.args[0])

    if (getRankUserDiscordId !== null) {
      if (!message.guild.member(getRankUserDiscordId)) {
        MessagesAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "Could not find that user on this server."
        )
        return 0
      }
      UserAPI.findByDiscord(getRankUserDiscordId).then(getRankUser => {
        if (getRankUser === null || getRankUser.steam === null) {
          MessagesAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "That user has not linked a steam id yet."
          )
          return 0
        }
        RanksAPI.getRankFromSteamID(getRankUser.steam).then(rank => {
          if (rank === null) {
            MessagesAPI.sendToChannelWithMention(
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

          MessagesAPI.sendToChannelWithMention(
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
            MessagesAPI.deleteMessage(message)
          }
          return 0
        })
      })
    } else if (parseInt(parsedCommand.args[0])) {
      let publicSteamId = parsedCommand.args[0]

      RanksAPI.getRankFromSteamID(publicSteamId).then(rank => {
        if (rank === null) {
          MessagesAPI.sendToChannelWithMention(
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

        MessagesAPI.sendToChannelWithMention(
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
          MessagesAPI.deleteMessage(message)
        }
        return 0
      })
    } else {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "Invalid arguments."
      )
    }
  } else {
    if (user !== null && user.steam !== null && user.steamLinkToken === null) {
      RanksAPI.getRankFromSteamID(user.steam).then(rank => {
        if (rank === null) {
          MessagesAPI.sendToChannelWithMention(
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

        MessagesAPI.sendToChannelWithMention(
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
            processRolesUpdate(message, nothing, false, false, true)
          } else {
            processRolesUpdate(message, nothing, false, false, false)
          }
        })
      })
    } else {
      MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        `You have not linked a steam id. Follow instructions in <#${
          client.channels.find(r => r.name === "readme").id
        }> to verify.`
      )
    }
  }
}

module.exports = {
  function: rank,
  isAdmin: false,
  scopes: ["all"]
}
