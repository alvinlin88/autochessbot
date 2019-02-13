
    const logger = require('./logger.js');

module.exports = {

    MessageConsolidator: class {
        

        constructor(discordClient) {
            this.discordClient = discordClient;
            this.messageQueues = [];
        }

        enqueueMessage(target, messageText, userToMentionId = null) {
            if (!this.messageQueues.hasOwnProperty(target)) {
                this.messageQueues[target] = {
                    targetObj: target,
                    messages: []
                };
                console.log("new queue");
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
                    aggregatedMessage = aggregatedMessage.concat(messages[messageIndex] + "\n");
                }
                messageTarget.send(aggregatedMessage).then(logger.info).catch(logger.error).then(logger.info).catch(logger.error);

                delete this.messageQueues[target];
            }
        }

    }
}