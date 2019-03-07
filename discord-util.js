"use strict";

const logger = require('./logger.js');
const mc = require('./message-consolidator.js');

const metrics = require("./metrics");

module.exports = class DiscordUtil {
    constructor(discordClient) {
        this.discordClient = discordClient;
    }

    sendChannelAndMention(channelDiscordId, userDiscordId, text, isDM=false) {
        let channel = this.discordClient.channels.get(channelDiscordId);
        let user = this.discordClient.users.get(userDiscordId);
        if (user === null) {
            logger.error("user is null");
            return 0;
        }
        mc.enqueueMessage(channel, text, userDiscordId);
        logger.info('Sent message in channel ' + channel.name + ' to ' + user.username + ': ' + text);
        if (isDM) {
            metrics.sendDMCounter.inc();
        } else {
            metrics.sendChannelCounter.inc({'channel_name': channel.name, 'channel_id': channelDiscordId});
        }
    }

    sendChannel(channelDiscordId, text, isDM=false) {
        let channel = this.discordClient.channels.get(channelDiscordId);
        mc.enqueueMessage(channel, text);
        logger.info('Sent message in channel ' + channel.name + ': ' + text);
        if (isDM) {
            metrics.sendDMCounter.inc();
        } else {
            metrics.sendChannelCounter.inc({'channel_name': channel.name, 'channel_id': channelDiscordId});
        }
    }

    sendDM(userDiscordId, text) {
        let user = this.discordClient.users.get(userDiscordId);
        if (user === null) {
            logger.error("user is null");
            return 0;
        }
        user.send(text).then(logger.info).catch(function (error) {
            if (error.code === 50007) {
                // TODO: figure out how to send this in the channel the user sent it from... we don't have message.channel.id
                this.sendChannelAndMention(this.discordClient.channels.find(r => r.name === "chessbot-warnings").id, userDiscordId, "I could not send a direct message to this user. They might have turned direct messages from server members off in their Discord Settings under 'Privacy & Safety'.");
            }
            logger.log(error);
        }.bind(this));
        logger.info("Sent direct message to user " + user.username + ": " + text);
        metrics.sendDMCounter.inc();
    }

    deleteMessage(message) {
        if (message.channel.type !== "dm") {
            message.delete("Processed").catch(logger.error);
            metrics.deleteMessageCounter.inc({'channel_name': message.channel.name, 'channel_id': message.channel.id});
        }
    }

    handle(message, result) {
        switch (result.type) {
            case 'channel':
                this.sendChannel(message.channel.id, result.reply);
                break;
            case 'channelMention':
                this.sendChannelAndMention(message.channel.id, message.author.id, result.reply);
                break;
            case 'dm':
                this.sendDM(message.author.id, result.reply);
                break;
        }
        if (result.delete === true) {
            this.deleteMessage(message);
        }
    }

};