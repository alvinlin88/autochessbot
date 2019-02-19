"use strict";

const logger = require('./logger.js');
const mc = require('./message-consolidator.js');

module.exports = class DiscordUtil {
    constructor(discordClient) {
        this.discordClient = discordClient;
    }

    sendChannelAndMention(channelDiscordId, userDiscordId, text) {
        let channel = this.discordClient.channels.get(channelDiscordId);
        let user = this.discordClient.users.get(userDiscordId);
        mc.enqueueMessage(channel, text, userDiscordId);
        logger.info('Sent message in channel ' + channel.name + ' to ' + user.username + ': ' + text);
    }

    sendChannel(channelDiscordId, text) {
        let channel = this.discordClient.channels.get(channelDiscordId);
        mc.enqueueMessage(channel, text);
        logger.info('Sent message in channel ' + channel.name + ': ' + text);
    }

    sendDM(userDiscordId, text) {
        let user = this.discordClient.users.get(userDiscordId);
        user.send(text).then(logger.info).catch(function (error) {
            if (error.code === 50007) {
                // TODO: figure out how to send this in the channel the user sent it from... we don't have message.channel.id
                this.sendChannelAndMention(this.discordClient.channels.find(r => r.name === "chessbot-warnings").id, userDiscordId, "I could not send a direct message to this user. They might have turned direct messages from server members off in their Discord Settings under 'Privacy & Safety'.");
            }
            logger.log(error);
        }.bind(this));
        logger.info("Sent direct message to user " + user.username + ": " + text);
    }

    deleteMessage(message) {
        if (message.channel.type !== "dm") {
            message.delete("Processed").catch(logger.error);
        }
    }

};