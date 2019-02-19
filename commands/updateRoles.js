const logger = require("../helpers/logger")
const MessagingAPI = require("../helpers/MessagingAPI")
const RanksAPI = require("../helpers/RanksAPI")
const { leagueRoles, leagueRequirements } = require("../config")

const updateRoles = (
  message,
  user,
  notifyOnChange = true,
  notifyNoChange = false,
  shouldDeleteMessage = false
) => {
  if (user !== null && user.steam !== null) {
    RanksAPI.getRankFromSteamID(user.steam).then(rank => {
      if (rank === null) {
        MessagingAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "I am having problems verifying your rank."
        )
        return 0
      }
      if (message.channel.type === "dm") {
        return 0 // can't update roles in DM.
      }
      if (message.guild === null) {
        MessagingAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "Something went wrong! I can not update your roles. Are you directly messaging me? Please use <#542465986859761676>."
        )
        return 0
      }
      let ranks = []

      leagueRoles.forEach(leagueRole => {
        let roleObj = message.guild.roles.find(r => r.name === leagueRole)

        if (roleObj !== null) {
          ranks.push({
            name: leagueRole,
            rank: leagueRequirements[leagueRole],
            role: message.guild.roles.find(r => r.name === leagueRole)
          })
        }
      })

      let added = []
      let removed = []

      let discordUser = message.guild.members.get(user.discord)

      if (discordUser === null) {
        MessagingAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "I am having a problem seeing your roles. Are you set to Invisible on Discord?"
        )
      } else {
        ranks.forEach(r => {
          if (discordUser.roles.has(r.role.id)) {
            if (rank.mmr_level < r.rank) {
              discordUser.removeRole(r.role).catch(logger.error)
              removed.push(r.name)
            }
          } else {
            if (rank.mmr_level >= r.rank) {
              discordUser.addRole(r.role).catch(logger.error)
              added.push(r.name)
            }
          }
        })

        let rankStr = RanksAPI.getRankString(rank.mmr_level)
        if (rankStr === "ERROR") {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "I had a problem getting your rank, did you use the right steam id? See <#542454956825903104> for more information. Use `!unlink` to start over."
          )
          return 0
        }

        let messagePrefix = "Your"
        let messagePrefix2 = "You have been"
        if (message.author.id !== user.discord) {
          messagePrefix = "<@" + user.discord + ">"
          messagePrefix2 = "<@" + user.discord + ">"
        }

        let MMRStr = ""
        if (rank.score !== null) {
          MMRStr = " MMR is: `" + rank.score + "`. "
        }

        // always show and whisper about demotions in case they cannot see the channel anymore
        if (removed.length > 0) {
          MessagingAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            messagePrefix +
              " rank is " +
              rankStr +
              "." +
              MMRStr +
              messagePrefix2 +
              " demoted from: `" +
              removed.join("`, `") +
              "` (sorry!)"
          )
          MessagingAPI.sendDM(
            message.author.id,
            messagePrefix +
              " rank is " +
              rankStr +
              "." +
              MMRStr +
              messagePrefix2 +
              " demoted from: `" +
              removed.join("`, `") +
              "` (sorry!)"
          )
        }

        if (notifyOnChange) {
          if (added.length > 0) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              messagePrefix +
                " rank is " +
                rankStr +
                "." +
                MMRStr +
                messagePrefix2 +
                " promoted to: `" +
                added.join("`, `") +
                "`"
            )
          }
        }
        if (notifyNoChange) {
          if (added.length === 0 && removed.length === 0) {
            MessagingAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              messagePrefix +
                " rank is " +
                rankStr +
                "." +
                MMRStr +
                " No role changes based on your rank."
            )
          }
        }
      }

      if (shouldDeleteMessage) {
        MessagingAPI.deleteMessage(message)
      }
      return 0
    })
  }
}

module.exports = updateRoles
