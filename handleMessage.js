const { adminRoleName, botChannels } = require("./config")
const logger = require("./helpers/logger")
const UserAPI = require("./helpers/UserAPI")
const { leagueLobbies } = require("./constants/leagues")
const MessagingAPI = require("./helpers/MessagingAPI")
const switchCase = require("./switchCase")

const PREFIX = "!cb"

function getParsedCommand(message) {
  // For "!cb" prefix
  if (message.content.substring(0, PREFIX.length) === PREFIX) {
    const args = message.content
      .slice(PREFIX.length)
      .trim()
      .split(/ +/g)
    const command = args.shift().toLowerCase()

    return { command: command, args: args }
  }

  // For "!" prefix
  if (message.content.substring(0, 1) === "!") {
    const args = message.content
      .slice(1)
      .trim()
      .split(/ +/g)
    const command = args.shift().toLowerCase()

    return { command: command, args: args }
  }

  // Non-bot message
  return false
}

const handleMessage = async message => {
  // ignore bot messages
  if (message.author.bot) {
    return
  }

  // private message
  if (message.channel.type === "dm") {
    // nothing
  }

  const parsedCommand = getParsedCommand(message)

  // Non-bot message
  if (!parsedCommand) {
    // logger.debug("Non-bot message: " + message.content);
    return
  }

  logger.info(" *** Received command: " + message.content)

  const isUserInvisible =
    message.channel.type !== "dm" &&
    (message.member === null || message.guild === null)

  if (isUserInvisible) {
    MessagingAPI.sendDM(
      message.author.id,
      "Error! Are you set to invisible mode?"
    )
    logger.error(
      "message.member: " +
        message.member +
        " or message.guild " +
        message.guild +
        " was null " +
        message.author.id +
        ": " +
        message.author.username +
        "#" +
        message.author.discriminator
    )

    return
  }

  if (
    message.channel.type !== "dm" &&
    message.member.roles.has(
      message.guild.roles.find(r => r.name === adminRoleName).id
    )
  ) {
    // if we can see user roles (not a DM) and user is staff, continue
  } else if (
    message.channel.type !== "dm" &&
    !leagueLobbies.includes(message.channel.name) &&
    !botChannels.includes(message.channel.name)
  ) {
    // otherwise if command was not typed in a whitelisted channel
    MessagingAPI.sendDM(
      message.author.id,
      "<#" +
        message.channel.id +
        "> You cannot use bot commands in this channel. Try <#542465986859761676>."
    )

    MessagingAPI.deleteMessage(message)

    return
  }

  let user = await UserAPI.findByDiscord(message.author.id)

  switchCase({ parsedCommand, user, message })
}

module.exports = handleMessage
