"use strict";

const PromClient = require('prom-client');
const express = require('express');
const app = express();

app.get('/metrics', (req, res) => {
    res.end(PromClient.register.metrics());
});

module.exports.startCollection = function() {
    PromClient.collectDefaultMetrics({ timeout: 5000 });
};

module.exports.sendDMCounter = new PromClient.Counter({
    name: 'send_dm',
    help: 'help',
});

module.exports.sendChannelCounter = new PromClient.Counter({
    name: 'send_channel',
    help: 'help',
    labelNames: ['channel_name', 'channel_id'],
});

module.exports.deleteMessageCounter = new PromClient.Counter({
    name: 'delete_message',
    help: 'help',
    labelNames: ['channel_name', 'channel_id'],
});

module.exports.dacRequestHistogram = new PromClient.Histogram({
    name: 'dac_response_time',
    help: 'help',
});

module.exports.steamRequestHistogram = new PromClient.Histogram({
    name: 'steam_response_time',
    help: 'help',
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

app.listen(3000);
