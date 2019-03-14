"use strict";

const PromClient = require('prom-client');

module.exports.startCollection = function() {
    PromClient.collectDefaultMetrics({ timeout: 5000 });
};

module.exports.sendDMCounter = new PromClient.Counter({
    name: 'send_dm',
    help: 'Number of direct messages sent',
});

module.exports.sendChannelCounter = new PromClient.Counter({
    name: 'send_channel',
    help: 'Number of channel messages sent',
    labelNames: ['channel_name', 'channel_id'],
});

module.exports.deleteMessageCounter = new PromClient.Counter({
    name: 'delete_message',
    help: 'Number of messages deleted',
    labelNames: ['channel_name', 'channel_id'],
});

module.exports.dacRequestHistogram = new PromClient.Histogram({
    name: 'dac_response_time',
    help: 'Response time for HTTP API calls to DAC',
});

module.exports.dacRequestSuccessCounter = new PromClient.Counter({
    name: 'dac_success',
    help: 'Number of successful DAC calls (200)',
});

module.exports.dacRequestErrorCounter = new PromClient.Counter({
    name: 'dac_error',
    help: 'Number of DAC calls that resulted in an error',
});

module.exports.steamRequestHistogram = new PromClient.Histogram({
    name: 'steam_response_time',
    help: 'help',
});

module.exports.steamRequestSuccessCounter = new PromClient.Counter({
    name: 'steam_success',
    help: 'Number of successful Steam calls (200)',
});

module.exports.steamRequestErrorCounter = new PromClient.Counter({
    name: 'steam_error',
    help: 'Number of Steam calls that resulted in an error',
});

module.exports.sequelizeSummary = new PromClient.Summary({
    name: 'db_query',
    help: 'help',
    labelNames: ['type'],
});

module.exports.commandInvocation = new PromClient.Counter({
    name: 'command_invocation',
    help: 'help',
    labelNames: ['channel_name', 'channel_id', 'name'],
});

module.exports.commandInvocationArgs = new PromClient.Counter({
    name: 'command_invocation_args',
    help: 'help',
    labelNames: ['channel_name', 'channel_id', 'name', 'args'],
});

