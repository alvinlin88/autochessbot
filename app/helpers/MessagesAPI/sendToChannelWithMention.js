const client = require("../client")
const MessageConsolidator = require("../MessageConsolidator")
const logger = require("../logger")

const sendToChannelWithMention = (channelDiscordId, userDiscordId, text) => {
  let channel = client.channels.get(channelDiscordId)
  let user = client.users.get(userDiscordId)
  MessageConsolidator.enqueueMessage(channel, text, userDiscordId)
  logger.info(
    "Sent message in channel " +
      channel.name +
      " to " +
      user.username +
      ": " +
      text
  )
}

module.exports = sendToChannelWithMention
