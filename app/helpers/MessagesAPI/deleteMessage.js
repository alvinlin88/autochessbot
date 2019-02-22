const logger = require("../logger")

const deleteMessage = message => {
  if (message.channel.type === "dm") return

  try {
    message.delete("Processed")
  } catch (err) {
    logger.error(err)
  }
}

module.exports = deleteMessage
