const logger = require('./logger.js');
const config = require("./config");
const CronJob = require('cron').CronJob;

class MessageConsolidator {
    constructor() {
        this.messageQueues = [];
        this.messageFlushCron = new CronJob(config.message_flush_cron, function() {
            this.processQueue();
        }.bind(this), null, /* don't start right after init */ false, 'America/Los_Angeles');
    }

    enqueueMessage(target, messageText, userToMentionId = null) {
        if (!this.messageQueues.hasOwnProperty(target)) {
            this.messageQueues[target] = {
                targetObj: target,
                messages: []
            };
        }
        if (userToMentionId != null) {
            messageText = '<@' + userToMentionId + '> ' + messageText;
        }
        this.messageQueues[target].messages.push(messageText);
    }

    processQueue() {
        for (let target in this.messageQueues) {
            let messageQueue = this.messageQueues[target];

            let messageTarget = messageQueue.targetObj;
            let messages = messageQueue.messages;

            let aggregatedMessage = "";
            for (let messageIndex in messages) {
                if (messages.hasOwnProperty(messageIndex)) {
                    if (aggregatedMessage.length + messages[messageIndex].length + 1 >= config.messageMaxLength) {
                        messageTarget.send(aggregatedMessage).then(logger.info).catch(logger.error).then(logger.info).catch(logger.error);
                        aggregatedMessage = "";
                    }
                    aggregatedMessage = aggregatedMessage.concat(messages[messageIndex] + "\n");
                }
            }
            messageTarget.send(aggregatedMessage).then(logger.info).catch(logger.error).then(logger.info).catch(logger.error);

            delete this.messageQueues[target];
        }
    }

    startMessageFlushCron() {
        this.messageFlushCron.start();
    }

}

module.exports = new MessageConsolidator();
