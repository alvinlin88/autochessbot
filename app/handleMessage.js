const { adminRoleName } = require("./config")
const logger = require("./helpers/logger")
const UserAPI = require("./helpers/UserAPI")
const RolesAPI = require("./helpers/RolesAPI")
const ChannelsAPI = require("./helpers/ChannelsAPI")
const MessagesAPI = require("./helpers/MessagesAPI")
const { getCommand } = require("./commands")

const PREFIX = "!cb"

const reject = ({ message, text, isPublic }) => {
  const author = message.author.id
  const channel = message.channel.id

  MessagesAPI.deleteMessage(message)

  if (isPublic) {
    MessagesAPI.sendToChannelWithMention(channel, author, text)
  } else {
    MessagesAPI.sendDM(author, text)
  }
}

const parseCommand = message => {
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
  if (message.author.bot) return

  // private message
  // if (message.channel.type === "dm") {}

  const parsedCommand = parseCommand(message)

  // Non-bot message
  if (!parsedCommand) return

  logger.info(" *** Received command: " + message.content)

  const isUserInvisible =
    message.channel.type !== "dm" &&
    (message.member === null || message.guild === null)

  if (isUserInvisible) {
    MessagesAPI.sendDM(
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

  const isAdmin = RolesAPI.messageAuthorHasRole(message, adminRoleName)

  if (
    message.channel.type !== "dm" &&
    !isAdmin &&
    !["lobbies", "commands", "tournament"].includes(
      ChannelsAPI.getScopeNameFromChannel(message.channel.name)
    )
  )
    return reject({
      message,
      text:
        "You cannot use bot commands in <#" +
        message.channel.id +
        "> channel. Try <#542465986859761676>."
    })

  const command = getCommand(parsedCommand.command)

  if (!isAdmin) {
    // Reject when command.isAdmin
    if (command.isAdmin)
      return reject({
        message,
        text: "You cannot use this command."
      })
  }

  // Compare the channel with the scopes
  let isMatched = false
  for (let scope of command.scopes) {
    if (ChannelsAPI.getScopeChannels(scope).includes(message.channel.name)) {
      isMatched = true
      break
    }
  }
  if (!isAdmin && !isMatched)
    return reject({
      message,
      text: "You cannot use this command in that channel."
    })

  // Even the staff cannot use command in any channel when it's isOnlyLobby
  if (
    command.isOnlyLobby &&
    ChannelsAPI.getScopeNameFromChannel(message.channel.name) !== "lobbies"
  )
    return reject({
      message,
      text: "You cannot use lobby command in that channel."
    })

  let user
  try {
    user = await UserAPI.findByDiscord(message.author.id)
  } catch (err) {
    logger.error(err)
    return
  }

  // Execute the command
  command.function({
    user,
    message,
    parsedCommand
  })
}

module.exports = handleMessage
