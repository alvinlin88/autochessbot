const client = require("../../helpers/client")
const MessagesAPI = require("../../helpers/MessagesAPI")
const RanksAPI = require("../../helpers/RanksAPI")
const LeaguesAPI = require("../../helpers/LeaguesAPI")
const UserAPI = require("../../helpers/UserAPI")
const parseDiscordId = require("../../helpers/discord/parseDiscordID")
const processRolesUpdate = require("../../helpers/processRolesUpdate")

const getNormalizedArg = arg => {
  const discordId = parseDiscordId(arg)

  if (discordId !== null)
    return {
      type: "discord",
      normalizedArg: discordId
    }

  const steamId = parseInt(arg)

  if (steamId)
    return {
      type: "steam",
      normalizedArg: steamId
    }

  return {
    type: "unknown"
  }
}

const rank = async ({ parsedCommand, user, message }) => {
  if (parsedCommand.args.length === 0) {
    if (!user || !user.steam || !user.steamLinkToken)
      return MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        `You have not linked a steam id. Follow instructions in <#${
          client.channels.find(r => r.name === "readme").id
        }> to verify.`
      )

    try {
      const rank = await RanksAPI.getRankFromSteamID(user.steam)

      if (rank === null)
        return MessagesAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "I am having problems verifying your rank."
        )

      let MMRStr = ""
      if (rank.score !== null) {
        MMRStr = " MMR is: `" + rank.score + "`. "
      }

      let verificationStatus = user.validated
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

      let updatedRank = { rank: rank.mmr_level, score: rank.score }
      if (rank.score === null) delete updatedRank["score"]
      const nothing = await user.update(updatedRank)

      if (LeaguesAPI.getAllLeaguesChannels().includes(message.channel.name)) {
        processRolesUpdate(message, nothing, false, false, true)
      } else {
        processRolesUpdate(message, nothing, false, false, false)
      }
    } catch (err) {
      return MessagesAPI.sendToChannelWithMention(
        message.channel.id,
        message.author.id,
        "I am having problems getting data from DAC servers."
      )
    }
  } else if (parsedCommand.args.length === 1) {
    const { type, normalizedArg } = getNormalizedArg(parsedCommand.args[0])

    switch (type) {
      case "discord": {
        if (!message.guild.member(user))
          return MessagesAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Could not find that user on this server."
          )

        try {
          const userData = await UserAPI.findByDiscord(user)

          if (!userData || !userData.steam)
            return MessagesAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "That user has not linked a steam id yet."
            )

          const rank = await RanksAPI.getRankFromSteamID(userData.steam)

          if (rank === null)
            return MessagesAPI.sendToChannelWithMention(
              message.channel.id,
              message.author.id,
              "I am having problems verifying your rank."
            )

          let MMRStr = ""
          if (rank.score !== null) {
            MMRStr = " MMR is: `" + rank.score + "`."
          }
          let verificationStatus =
            userData.validated === true
              ? "[✅ Verified] "
              : `[❌ Follow instructions in <#${
                client.channels.find(r => r.name === "readme").id
              }> to verify] `

          MessagesAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            verificationStatus +
              "Current rank for <@" +
              userData.discord +
              "> is: " +
              RanksAPI.getRankString(rank.mmr_level) +
              "." +
              MMRStr
          )

          if (
            LeaguesAPI.getAllLeaguesChannels().includes(message.channel.name)
          ) {
            MessagesAPI.deleteMessage(message)
          }
          return
        } catch (err) {
          return MessagesAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "Something went wrong."
          )
        }
      }
      case "steam": {
        const rank = await RanksAPI.getRankFromSteamID(normalizedArg)

        if (!rank)
          return MessagesAPI.sendToChannelWithMention(
            message.channel.id,
            message.author.id,
            "I am having problems verifying the rank for " + normalizedArg + "."
          )

        let MMRStr = ""
        if (rank.score !== null) {
          MMRStr = " MMR is: `" + rank.score + "`."
        }

        if (user.steam === normalizedArg) {
          //todo remind about people they can just use !rank with no param
        }

        MessagesAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "Current rank for " +
            normalizedArg +
            " is: " +
            RanksAPI.getRankString(rank.mmr_level) +
            "." +
            MMRStr
        )

        if (LeaguesAPI.getAllLeaguesChannels().includes(message.channel.name)) {
          MessagesAPI.deleteMessage(message)
        }
        return
      }
      default: {
        return MessagesAPI.sendToChannelWithMention(
          message.channel.id,
          message.author.id,
          "Invalid arguments."
        )
      }
    }
  } else {
    return MessagesAPI.sendToChannelWithMention(
      message.channel.id,
      message.author.id,
      "Invalid arguments."
    )
  }
}

module.exports = {
  function: rank,
  isAdmin: false,
  scopes: ["all"]
}
