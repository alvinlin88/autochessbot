const client = require("../client")
const logger = require("../logger")
const sendToChannelWithMention = require("./sendToChannelWithMention")

const sendDM = async (userDiscordId, text) => {
  const user = client.users.get(userDiscordId)

  try {
    const result = await user.send(text)
    logger.info(result)
  } catch (err) {
    if (err.code === 50007) {
      // TODO: figure out how to send this in the channel the user sent it from... we don't have message.channel.id
      sendToChannelWithMention(
        client.channels.find(r => r.name === "chessbot-commands").id,
        userDiscordId,
        "It looks like you might have turned off direct messages from server members in your Discord Settings under 'Privacy & Safety'. Please turn this setting on to receive bot messages."
      )
      sendToChannelWithMention(
        client.channels.find(r => r.name === "chessbot-warnings").id,
        userDiscordId,
        "I could not send a direct message to this user. They might have turned direct messages from server members off in their Discord Settings under 'Privacy & Safety'."
      )
    }
    logger.log(err)
  }

  logger.info("Sent direct message to user " + user.username + ": " + text)
}

module.exports = sendDM
