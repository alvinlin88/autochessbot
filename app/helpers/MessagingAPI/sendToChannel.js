const client = require("../client")
const MessageConsolidator = require("../MessageConsolidator")
const logger = require("../logger")

const sendToChannel = (channelDiscordId, text) => {
  let channel = client.channels.get(channelDiscordId)
  MessageConsolidator.enqueueMessage(channel, text)
  logger.info("Sent message in channel " + channel.name + ": " + text)
}

module.exports = sendToChannel