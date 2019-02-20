const logger = require("./logger");
const config = require("../config");
const CronJob = require("cron").CronJob;

const MessageConsolidator = () => {
  const messageQueues = [];

  const enqueueMessage = (target, messageText, userToMentionId = null) => {
    if (!messageQueues.hasOwnProperty(target)) {
      messageQueues[target] = {
        targetObj: target,
        messages: []
      };
    }
    if (userToMentionId != null) {
      messageText = "<@" + userToMentionId + "> " + messageText;
    }
    messageQueues[target].messages.push(messageText);
  };

  const processQueue = () => {
    for (let target in messageQueues) {
      let messageQueue = messageQueues[target];

      let messageTarget = messageQueue.targetObj;
      let messages = messageQueue.messages;

      let aggregatedMessage = "";
      for (let messageIndex in messages) {
        if (messages.hasOwnProperty(messageIndex)) {
          if (
            aggregatedMessage.length + messages[messageIndex].length + 1 >=
            config.messageMaxLength
          ) {
            messageTarget
              .send(aggregatedMessage)
              .then(logger.info)
              .catch(logger.error)
              .then(logger.info)
              .catch(logger.error);
            aggregatedMessage = "";
          }
          aggregatedMessage = aggregatedMessage.concat(
            messages[messageIndex] + "\n"
          );
        }
      }
      messageTarget
        .send(aggregatedMessage)
        .then(logger.info)
        .catch(logger.error)
        .then(logger.info)
        .catch(logger.error);

      delete messageQueues[target];
    }
  };

  new CronJob(
    config.message_flush_cron,
    processQueue,
    null,
    true,
    "America/Los_Angeles"
  );

  return {
    enqueueMessage
  };
};

module.exports = MessageConsolidator();
