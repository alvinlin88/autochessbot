const Discord = require('discord.js'),
    discordClient = new Discord.Client();

const randtoken = require("rand-token");

const config = require("./config");

const logger = require('./logger.js');

const request = require('request');

const Sequelize = require('sequelize');
const Op = Sequelize.Op;

const User = require('./schema/user.js');

const Lobbies = require("./lobbies.js"),
    lobbies = new Lobbies();
lobbies.restoreLobbies();
lobbies.startBackupJob();

PREFIX = "!cb ";

let botDownMessage = "Bot is restarting. Lobby commands are currently disabled. Be back in a second!";

let adminRoleName = config.adminRoleName;
let leagueRoles = config.leagueRoles;
let leagueToLobbiesPrefix = config.leagueToLobbiesPrefix;
let lobbiesToLeague = config.lobbiesToLeague;
let leagueRequirements = config.leagueRequirements;
let validRegions = config.validRegions;
let exemptLeagueRolePruning = config.exemptLeagueRolePruning;
let botChannels = config.botChannels;
let listratelimit = {};
let disableLobbyCommands = false;
let disableLobbyHost = false;

let leagueLobbies = [];
let leagueChannelToRegion = {};
leagueRoles.forEach(leagueRole => {
    leagueLobbies.push(leagueToLobbiesPrefix[leagueRole]);
    lobbiesToLeague[leagueToLobbiesPrefix[leagueRole]] = leagueRole;
    leagueChannelToRegion[leagueToLobbiesPrefix[leagueRole]] = null;
    validRegions.forEach(leagueRegion => {
        leagueLobbies.push(leagueToLobbiesPrefix[leagueRole] + "-" + leagueRegion.toLowerCase());
        lobbiesToLeague[leagueToLobbiesPrefix[leagueRole] + "-" + leagueRegion.toLowerCase()] = leagueRole;
        leagueChannelToRegion[leagueToLobbiesPrefix[leagueRole] + "-" + leagueRegion.toLowerCase()] = leagueRegion;
    });
});

function parseCommand(message) {
    if (message.content.substring(0, PREFIX.length) === PREFIX) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/g);
        const command = args.shift().toLowerCase();

        return {command: command, args: args};
    }
    if (message.content.substring(0, 1) === "!") {
        const args = message.content.slice(1).trim().split(/ +/g);
        const command = args.shift().toLowerCase();

        return {command: command, args: args};
    }
}

function sendChannelandMention(channelDiscordId, userDiscordId, text) {
    let channel = discordClient.channels.get(channelDiscordId);
    let user = discordClient.users.get(userDiscordId);
    channel.send('<@' + user.id + '> ' + text).then(logger.info).catch(logger.error).then(logger.info).catch(logger.error);
    logger.info('Sent message in channel ' + channel.name + ' to ' + user.username + ': ' + text);
}

function sendChannel(channelDiscordId, text) {
    let channel = discordClient.channels.get(channelDiscordId);
    channel.send(text).then(logger.info).catch(logger.error).then(logger.info).catch(logger.error);
    logger.info('Sent message in channel ' + channel.name + ': ' + text);
}

function sendDM(userDiscordId, text) {
    let user = discordClient.users.get(userDiscordId);
    user.send(text).then(logger.info).catch(function(error) {
        if (error.code === 50007) {
            // TODO: figure out how to send this in the channel the user sent it from... we don't have message.channel.id
            sendChannelandMention(discordClient.channels.find(r => r.name === "chessbot-commands").id, userDiscordId, "It looks like you might have turned off direct messages from server members in your Discord Settings under 'Privacy & Safety'. Please turn this setting on to receive bot messages.");
            sendChannelandMention(discordClient.channels.find(r => r.name === "chessbot-warnings").id, userDiscordId, "I could not send a direct message to this user. They might have turned direct messages from server members off in their Discord Settings under 'Privacy & Safety'.");
        }
        logger.log(error);
    });
    logger.info("Sent direct message to user " + user.username + ": " + text);
}

function deleteMessage(message) {
    if (message.channel.type !== "dm") {
        message.delete("Processed").catch(logger.error);
    }
}

function getRank(rank) {
    if (rank === 0) { return ["", "Unranked"]; }
    if (rank > 0 && rank <= 9) { return ["♟", "Pawn", (rank).toString()]; }
    if (rank >= 10 && rank < (10 + 9)) { return ["♞", "Knight", (rank - 9).toString()]; }
    if (rank >= (10 + 9) && rank < (10 + 9 + 9)) { return ["♝", "Bishop", (rank - 9 - 9).toString()]; }
    if (rank >= (10 + 9 + 9) && rank < (10 + 9 + 9 + 9)) { return ["♖", "Rook", (rank - 9 - 9 - 9).toString()]; }
    if (rank >= (10 + 9 + 9 + 9) && rank < (10 + 9 + 9 + 9 + 1)) { return ["♚", "King"]; }
    if (rank >= (10 + 9 + 9 + 9 + 1)) { return ["♕", "Queen"]; }
    // if (rank >= (10 + 9 + 9 + 9) && rank < (10 + 9 + 9 + 9 + 1)) { return "King-" + (rank - 9 - 9 - 9 - 9).toString(); }
    // if (rank >= (10 + 9 + 9 + 9 + 1)) { return "Queen-" + (rank - 9 - 9 - 9 - 9 - 1).toString(); }
    return "ERROR";
}

function getRankString(rank) {
    let rankData = getRank(rank);
    if (rankData.length === 2) { return "**" + rankData[0] + " " + rankData[1] + "**"; }
    if (rankData.length === 3) { return "**" + rankData[0] + " " + rankData[1] + "-" + rankData[2] + "**"; }
    return "ERROR";
}

function parseRank(rankInput) {
    let stripped = rankInput.toLowerCase().replace(/\W+/g, '');
    let rankStr = stripped.replace(/[0-9]/g, '');
    let rankNum = stripped.replace(/[a-z]/g, '');

    let mappings = {"pawn": 0, "knight": 1, "bishop": 2, "rook": 3, "king": 4, "queen": 5};

    if (rankStr === "king") return 37;
    if (rankStr === "queen") return 38;

    if (rankNum < 1 || rankNum > 9) {
        return null;
    }
    if (!mappings.hasOwnProperty(rankStr)) {
        return null;
    }

    let rank = 0;

    rank = rank + mappings[rankStr] * 9;
    rank = rank + parseInt(rankNum);

    return rank;
}

let DACSwitch = 2;
// TODO: Circuit breaker
let lastDACASuccess = Date.now();
let lastDACBSuccess = Date.now();

function getRankFromSteamId(steamId) {
    return new Promise(function(resolve, reject) {
        if (DACSwitch === 1) {
            getRankFromSteamIdA(steamId).then(result => {
                resolve(result);
            });
        } else if (DACSwitch === 2) {
            getRankFromSteamIdB(steamId).then(result => {
                resolve(result);
            });
        } else {
            logger.error("Error getting any results from DAC Servers! :(");
            sendChannelandMention(discordClient.channels.find(r => r.name === "chessbot-warnings").id, "Error getting any results from DAC Servers! :(");
            resolve(null);
        }
    });
}

function getRankFromSteamIdB(steamId) {
    return new Promise(function(resolve, reject) {
        request('http://101.200.189.65:431/dac/heros/get/@' + steamId, { json: true}, (err, res, body) => {
            if (err) {
                resolve(null); logger.error(err);
            }

            if (res !== undefined && res.hasOwnProperty("statusCode")) {
                if (res.statusCode === 200 && body.err === 0) {
                    try {
                        // logger.info("Got result from server: " + JSON.stringify(body.user_info));
                        if (body.user_info.hasOwnProperty(steamId)) {
                            lastDACBSuccess = Date.now();
                            resolve({
                                "mmr_level": body.user_info[steamId]["mmr_level"],
                                "score": null,
                            })
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        logger.error(error.message + " " + error.stack);
                    }
                } else {
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        });
    });
}

function getRankFromSteamIdA(steamId) {
    return new Promise(function(resolve, reject) {
        request('http://101.200.189.65:431/dac/ranking/get?player_ids=' + steamId, { json: true}, (err, res, body) => {
            if (err) {
                resolve(null); logger.error(err);
            }

            if (res !== undefined && res.hasOwnProperty("statusCode")) {
                if (res.statusCode === 200 && body.err === 0) {
                    try {
                        // logger.info("Got result from server: " + JSON.stringify(body.user_info));
                        lastDACASuccess = Date.now();
                        if (body.ranking_info.length === 1) {
                            resolve({
                                "mmr_level": body.ranking_info[0]["mmr_level"],
                                "score": body.ranking_info[0]["score"],
                            })
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        logger.error(error.message + " " + error.stack);
                    }
                } else {
                    // use other endpoint without score
                    getRankFromSteamIdB(steamId).then(promise => {
                        resolve(promise);
                    });
                }
            } else {
                resolve(null);
            }
        });
    });
}

function getRanksFromSteamIdList(steamIdList) {
    return new Promise(function(resolve, reject) {
        request('http://101.200.189.65:431/dac/ranking/get?player_ids=' + steamIdList.join(','), { json: true}, (err, res, body) => {
            if (err) { reject(err); }

            if (res !== undefined && res.hasOwnProperty("statusCode")) {
                if (res.statusCode === 200) {
                    try {
                        // logger.info("Got result from server: " + JSON.stringify(body.ranking_info));
                        resolve(body.ranking_info);
                    } catch (error) {
                        logger.error(error.message + " " + error.stack);
                    }
                }
            }
        });
    });
}

function parseDiscordId(discordStr) {
    if (discordStr.substring(1, 2) === "@") {
        let result = discordStr.substring(2, discordStr.length - 1);

        if (result[0] === "!") {
            result = result.substring(1);
        }

        return result;
    } else {
        return null;
    }
}

function getLobbyForHost(leagueChannel, host) {
    return lobbies.getLobbyForHostSafe(leagueChannel, host);
}

function getSteamPersonaNames(steamIds) {
    return new Promise(function(resolve, reject) {
        request("http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=" + config.steam_token + "&steamids=" + steamIds.join(","), { json: true}, (err, res, body) => {
            if (err) { reject(err); }

            if (res !== undefined && res.hasOwnProperty("statusCode")) {
                if (res.statusCode === 200) {
                    try {
                        // logger.info("Got result from server: " + JSON.stringify(body.response));

                        let personaNames = {};

                        steamIds.forEach(steamId => {
                            personaNames[steamId] = "ERROR";
                        });

                        for (let playerKey in body.response.players) {
                            if (body.response.players.hasOwnProperty(playerKey)) {
                                let player = body.response.players[playerKey];

                                personaNames[player["steamid"]] = player["personaname"];
                            }
                        }

                        resolve(personaNames);
                    } catch (error) {
                        logger.error(error.message + " " + error.stack);
                    }
                }
            }
        });
    });

}

function getSteamProfiles(steamIds) {
    return new Promise(function(resolve, reject) {
        request("http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=" + config.steam_token + "&steamids=" + steamIds.join(","), { json: true}, (err, res, body) => {
            if (err) { reject(err); }

            if (res !== undefined && res.hasOwnProperty("statusCode")) {
                if (res.statusCode === 200) {
                    try {
                        // logger.info("Got result from server: " + JSON.stringify(body.response));

                        let personaNames = {};

                        for (let playerKey in body.response.players) {
                            if (body.response.players.hasOwnProperty(playerKey)) {
                                let player = body.response.players[playerKey];

                                personaNames[player["steamid"]] = player;
                            }
                        }

                        resolve(personaNames);
                    } catch (error) {
                        logger.error(error.message + " " + error.stack);
                    }
                }
            }
        });
    });
}

function updateRoles(message, user, notifyOnChange=true, notifyNoChange=false, shouldDeleteMessage=false) {
    if (user !== null && user.steam !== null) {
        getRankFromSteamId(user.steam).then(rank => {
            if(rank === null) {
                sendChannelandMention(message.channel.id, message.author.id, "I am having problems verifying your rank.");
                return 0;
            }
            if (message.channel.type === "dm") {
                return 0; // can't update roles in DM.
            }
            if (message.guild === null) {
                sendChannelandMention(message.channel.id, message.author.id, "Something went wrong! I can not update your roles. Are you directly messaging me? Please use <#542465986859761676>.");
                return 0;
            }
            let ranks = [];

            leagueRoles.forEach(leagueRole => {
                let roleObj = message.guild.roles.find(r => r.name === leagueRole);

                if (roleObj !== null) {
                    ranks.push({
                        name: leagueRole,
                        rank: leagueRequirements[leagueRole],
                        role: message.guild.roles.find(r => r.name === leagueRole),
                    })
                }
            });

            let added = [];
            let removed = [];

            let discordUser = message.guild.members.get(user.discord);

            if (message.guild === null) {
                sendChannelandMention(message.channel.id, message.author.id, "Something went wrong! I can not update your roles. Are you directly messaging me? Please use <#542465986859761676>.");
            }

            if (discordUser === null) {
                sendChannelandMention(message.channel.id, message.author.id, "I am having a problem seeing your roles. Are you set to Invisible on Discord?");
            } else {
                ranks.forEach(r => {
                    if (discordUser.roles.has(r.role.id)) {
                        if (rank.mmr_level < r.rank) {
                            discordUser.removeRole(r.role).catch(logger.error);
                            removed.push(r.name);
                        }
                    } else {
                        if (rank.mmr_level >= r.rank) {
                            discordUser.addRole(r.role).catch(logger.error);
                            added.push(r.name);
                        }
                    }
                });

                let rankStr = getRankString(rank.mmr_level);
                if (rankStr === "ERROR") {
                    sendChannelandMention(message.channel.id, message.author.id, "I had a problem getting your rank, did you use the right steam id? See <#542454956825903104> for more information. Use `!unlink` to start over.");
                    return 0;
                }

                let messagePrefix = "Your";
                let messagePrefix2 = "You have been";
                if (message.author.id !== user.discord) {
                    messagePrefix = "<@" + user.discord + ">";
                    messagePrefix2 = "<@" + user.discord + ">";
                }

                let MMRStr = "";
                if (rank.score !== null) {
                    MMRStr =  " MMR is: `" + rank.score + "`. ";
                }

                // always show and whisper about demotions in case they cannot see the channel anymore
                if (removed.length > 0) {
                    sendChannelandMention(message.channel.id, message.author.id, messagePrefix + " rank is " + rankStr + "." + MMRStr + messagePrefix2 + " demoted from: `" + removed.join("`, `") + "` (sorry!)");
                    sendDM(message.author.id, messagePrefix + " rank is " + rankStr + "." + MMRStr + messagePrefix2 + " demoted from: `" + removed.join("`, `") + "` (sorry!)");
                }

                if (notifyOnChange) {
                    if (added.length > 0) {
                        sendChannelandMention(message.channel.id, message.author.id, messagePrefix + " rank is " + rankStr + "." + MMRStr + messagePrefix2 + " promoted to: `" + added.join("`, `") + "`");
                    }
                }
                if (notifyNoChange) {
                    if (added.length === 0 && removed.length === 0) {
                        sendChannelandMention(message.channel.id, message.author.id, messagePrefix + " rank is " + rankStr + "." + MMRStr + " No role changes based on your rank.");

                    }
                }
            }

            if (shouldDeleteMessage) {
                deleteMessage(message);
            }
            return 0;
        });
    }
}

discordClient.on('ready', () => {
    logger.info(`Logged in as ${discordClient.user.tag}!`);
    try {
        discordClient.channels.get("542754359860264981").send("I am back!").then(logger.info).catch(logger.error);
    } catch(err) {
        logger.error(err);
    }
});

discordClient.on('error', logger.error);

discordClient.on('message', message => {

    if (message.author.bot === true) {
        return 0; // ignore bot messages
    }
    // private message
    if (message.channel.type === "dm") {
        // nothing
    }
    if (!(message.content.substring(0, PREFIX.length) === PREFIX || message.content.substring(0, 1) === "!")) {
        // logger.debug("Non-bot message: " + message.content);
        return 0;
    }

    logger.info(" *** Received command: " + message.content);

    let parsedCommand = parseCommand(message);
    let userPromise = User.findOne({where: {discord: message.author.id}});

    if (message.channel.type !== "dm" && (message.member === null || message.guild === null)) {
        sendDM(message.author.id, "Error! Are you set to invisible mode?");
        logger.error("message.member: " + message.member + " or message.guild " + message.guild + " was null " + message.author.id + ": " + message.author.username + "#" + message.author.discriminator);

        return 0;
    }

    if (message.channel.type !== "dm" && message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) {
        // if we can see user roles (not a DM) and user is staff, continue
    } else if (message.channel.type !== "dm" && !leagueLobbies.includes(message.channel.name) && !botChannels.includes(message.channel.name)) {
        // otherwise if command was not typed in a whitelisted channel
        sendDM(message.author.id, "<#" + message.channel.id + "> You cannot use bot commands in this channel. Try <#542465986859761676>.");
        deleteMessage(message);
        return 0;
    }

    userPromise.then(user => {
        let isLobbyCommand = null;

        if (leagueLobbies.includes(message.channel.name)) {
            let leagueRole = lobbiesToLeague[message.channel.name];
            let leagueChannel = message.channel.name;
            let leagueChannelRegion = leagueChannelToRegion[leagueChannel];

            if (user === null || user.steam === null) {
                sendChannelandMention(message.channel.id, message.author.id, "You need to link a steam id to use bot commands in lobbies. See <#542454956825903104> for more information.");
                return 0;
            }

            switch (parsedCommand.command) {
                case "admincancel":
                case "adminclose":
                case "adminend":
                case "adminunhost":
                    (function () {
                        if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                        if (parsedCommand.args.length !== 1) {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, the command is `!admincancel [@host]`");
                        }

                        let hostLobbyDiscordId = parseDiscordId(parsedCommand.args[0]);
                        User.find({where: {discord: hostLobbyDiscordId}}).then(hostUser => {
                            let hostLobbyEnd = getLobbyForHost(leagueChannel, hostUser.steam);
                            let regionEnd = hostLobbyEnd["region"];

                            lobbies.deleteLobby(leagueChannel, hostUser.steam);
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, I cancelled <@" + hostUser.discord + ">'s lobby for @" + regionEnd + ".");
                            sendDM(hostUser.discord, "**Your lobby in <#" + message.channel.id + " was cancelled by an admin.**");
                        });
                    })();
                    break;
                case "adminkick":
                    (function () {
                        if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                        if (parsedCommand.args.length !== 2) {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, the command is `!adminkick [@host] [@player]`.");
                            return 0;
                        }
                        let hostDiscordIdKick = parseDiscordId(parsedCommand.args[0]);
                        let playerDiscordIdKick = parseDiscordId(parsedCommand.args[1]);

                        if (hostDiscordIdKick === null) {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, that host id is invalid.");
                        }
                        if (playerDiscordIdKick === null) {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, that player id is invalid.");
                        }

                        User.findOne({where: {discord: hostDiscordIdKick}}).then(hostUser => {
                            User.findOne({where: {discord: playerDiscordIdKick}}).then(playerUser => {
                                let hostLobby = getLobbyForHost(leagueChannel, hostUser.steam);
                                if (hostLobby === null) {
                                    sendChannelandMention(message.channel.id, message.author.id, "Sir, that person is not hosting a lobby currently.");
                                    return 0;
                                }
                                if (hostUser.steam === playerUser.steam) {
                                    sendChannelandMention(message.channel.id, message.author.id, "Sir, you can not kick the host from their own lobby. Use `!admincancel [@host]` instead.");
                                    return 0;
                                }

                                lobbies.removePlayerFromLobby(leagueChannel, hostUser.steam, playerUser.steam);
                                let kickUserName = message.client.users.find("id", playerUser.discord);
                                sendChannelandMention(message.channel.id, message.author.id, "kicked " + kickUserName + " from <@" + hostUser.discord + "> @" + hostLobby.region + " region lobby. `(" + getLobbyForHost(leagueChannel, hostUser.steam).players.length + "/8)`");
                                sendDM(playerUser.discord, "<#" + message.channel.id + "> An admin kicked you from <@" + hostUser.discord + "> @" + hostLobby.region + " region lobby.");

                            });
                        });
                    })();
                    break;
                case "host":
                    (function () {
                        if (disableLobbyCommands === true) {
                            sendChannelandMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }
                        if (disableLobbyHost === true) {
                            sendChannelandMention(message.channel.id, message.author.id, "Lobby hosting disabled. Bot is going down for maintenance.");
                        }

                        let hostLobbyExist = getLobbyForHost(leagueChannel, user.steam);

                        if (hostLobbyExist !== null) {
                            sendChannelandMention(message.channel.id, message.author.id, "You are already hosting a lobby. Type `!lobby` to see players.");
                            return 0;
                        }
                        if (parsedCommand.args.length === 0) {
                            if (leagueChannelRegion !== null) {
                                parsedCommand.args[0] = leagueChannelRegion;
                            } else {
                                sendChannelandMention(message.channel.id, message.author.id, "Invalid arguments. Try `!host [" + validRegions.join(', ').toLowerCase() + "] [rank-1]`. Example: `!host na bishop-1`. (no spaces in rank)");
                                return 0;
                            }
                        }

                        let region = parsedCommand.args[0].toUpperCase();

                        if (leagueChannelRegion !== null && leagueChannelRegion !== region) {
                            sendChannelandMention(message.channel.id, message.author.id, "You can only host " + leagueChannelRegion + " region lobbies in this channel.");
                            return 0;
                        }


                        let rankRequirement = leagueRequirements[leagueRole];

                        if (parsedCommand.args.length === 1) {
                            rankRequirement = leagueRequirements[leagueRole];
                        } else if (parsedCommand.args.length === 2) {
                            rankRequirement = parseRank(parsedCommand.args[1]);

                            if (rankRequirement === null) {
                                sendChannelandMention(message.channel.id, message.author.id, "Invalid rank requirement. Example: `!host " + region.toLowerCase() + " bishop-1`. (no spaces in rank)");
                                return 0;
                            }
                        } else if (parsedCommand.args.length > 2) {
                            sendChannelandMention(message.channel.id, message.author.id, "Invalid arguments. Must be `!host [" + validRegions.join(', ').toLowerCase() + "]` [rank-1]`. Example: `!host na bishop-1`. (no spaces in rank)");
                            return 0;
                        }

                        if (!validRegions.includes(region)) {
                            sendChannelandMention(message.channel.id, message.author.id, "Invalid arguments. Must be `!host [" + validRegions.join(', ').toLowerCase() + "] [rank-1]`. Example: `!host na bishop-1`. (no spaces in rank)");
                            return 0;
                        }

                        // create lobby
                        getRankFromSteamId(user.steam).then(rank => {
                            if (rank === null) {
                                sendChannelandMention(message.channel.id, message.author.id, "I am having problems verifying your rank.");
                                return 0;
                            }
                            let rankUpdate = {rank: rank.mmr_level, score: rank.score};
                            if (rank.score === null) delete rankUpdate["score"];
                            user.update(rankUpdate);
                            if (rank.mmr_level < leagueRequirements[leagueRole]) {
                                sendChannelandMention(message.channel.id, message.author.id, "You are not high enough rank to host this lobby. (Your rank: " + getRankString(rank.mmr_level) + ", required rank: " + getRankString(leagueRequirements[leagueRole]) + ")");
                                return 0;
                            }
                            if (rank.mmr_level < rankRequirement) {
                                sendChannelandMention(message.channel.id, message.author.id, "You are not high enough rank to host this lobby. (Your rank: " + getRankString(rank.mmr_level) + ", required rank: " + getRankString(rankRequirement) + ")");
                                return 0;
                            }
                            // good to start
                            let token = randtoken.generate(5);
                            let newLobby = lobbies.createLobby(leagueChannel, user.steam, region, rankRequirement, token);

                            // let currentLobby = getLobbyForPlayer(leagueChannel, user.steam);

                            sendChannelandMention(message.channel.id, message.author.id, "**=== <@&" + message.guild.roles.find(r => r.name === region).id + "> Lobby started by <@" + user.discord + "> " + getRankString(rank.mmr_level) + ". Type \"!join <@" + user.discord + ">\" to join! [" + getRankString(newLobby["rankRequirement"]) + " required to join]** \nThe bot will whisper you the password on Discord. Make sure you are allowing direct messages from server members in your Discord Settings. \nPlease _DO NOT_ post lobby passwords here.", false);
                            sendDM(message.author.id, "<#" + message.channel.id + "> **Please host a private Dota Auto Chess lobby in @" + region + " region with the following password:** `" + newLobby["password"] + "`. \nPlease remember to double check people's ranks and make sure the right ones joined the game before starting. \nYou can see the all players in the lobby by using `!lobby` in the channel. \nWait until the game has started in the Dota 2 client before typing `!start`. \nIf you need to kick a player from the Discord lobby that has not joined your Dota 2 lobby or if their rank changed, use `!kick @player` in the channel.");
                        });
                    })();
                    break;
                case "start":
                    (function () {
                        if (disableLobbyCommands === true) {
                            sendChannelandMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        // check 8/8 then check all ranks, then send passwords
                        let lobby = lobbies.getLobbyForHost(leagueChannel, user.steam);

                        if (lobby === undefined || lobby === null) {
                            sendDM(message.author.id, "You are not hosting any lobbies in <#" + message.channel.id + ">");
                            deleteMessage(message);
                            return 0;
                        }

                        if (parsedCommand.args.length > 0) { // TODO: DRY
                            let force = parsedCommand.args[0];

                            if (force !== "force") {
                                sendChannelandMention(message.channel.id, message.author.id, "Invalid arguments");
                                return 0;
                            }
                            if (lobby.players.length < 2) {
                                sendChannelandMention(message.channel.id, message.author.id, "You need at least 2 players to force start a lobby. `(" + lobby.players.length + "/8)`");
                                return 0;
                            }

                            let wheres = [];
                            lobby.players.forEach(steamId => {
                                wheres.push({steam: steamId});
                            });
                            User.findAll({where: {[Op.or]: wheres}}).then(players => {
                                getSteamPersonaNames(lobby.players).then(personas => {
                                    let playerDiscordIds = [];
                                    let hostUserDiscordId = null;

                                    players.forEach(player => {
                                        if (player.steam !== lobby.host) {
                                            playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam].replace(/`/g, '') + "\" " + getRankString(player.rank) + "");
                                        } else {
                                            playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam].replace(/`/g, '') + "\" " + getRankString(player.rank) + " **[Host]**");
                                            hostUserDiscordId = player.discord;
                                        }
                                    });

                                    lobbies.deleteLobby(leagueChannel, user.steam);

                                    sendChannelandMention(message.channel.id, message.author.id, "**@" + lobby.region + " region lobby started. Good luck!** " + playerDiscordIds.join(" | "));
                                });
                            });
                        } else {
                            if (lobby.players.length === 8) {
                                let wheres = [];
                                lobby.players.forEach(steamId => {
                                    wheres.push({steam: steamId});
                                });
                                User.findAll({where: {[Op.or]: wheres}}).then(players => {
                                    getSteamPersonaNames(lobby.players).then(personas => {
                                        let playerDiscordIds = [];
                                        let hostUserDiscordId = null;

                                        players.forEach(player => {
                                            if (player.steam !== lobby.host) {
                                                playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam].replace(/`/g, '') + "\" " + getRankString(player.rank));
                                            } else {
                                                playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam].replace(/`/g, '') + "\" " + getRankString(player.rank) + " **[Host]**");
                                                hostUserDiscordId = player.discord;
                                            }
                                        });

                                        sendChannelandMention(message.channel.id, message.author.id, "**@" + lobby["region"] + " region lobby started. Good luck!** " + playerDiscordIds.join(" | "));
                                        lobbies.deleteLobby(leagueChannel, user.steam);
                                    });
                                });
                            } else {
                                sendChannelandMention(message.channel.id, message.author.id, "Not enough players to start yet. `(" + lobby.players.length + "/8)`");
                            }
                        }
                    })();
                    break;
                case "join":
                    (function () {
                        if (disableLobbyCommands === true) {
                            sendChannelandMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        let playerLobbyJoin = lobbies.getLobbyForPlayer(leagueChannel, user.steam);

                        if (playerLobbyJoin !== null) {
                            sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You are already in a lobby! Use `!leave` to leave.");
                            deleteMessage(message);
                            return 0;
                        }
                        if (parsedCommand.args.length === 0) {
                            if (leagueChannelRegion === null) {
                                sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Need to specify a host or region to join.");
                                deleteMessage(message);
                                return 0;
                            } else {
                                parsedCommand.args[0] = leagueChannelRegion;
                            }
                        }

                        getRankFromSteamId(user.steam).then(rank => {
                            if (rank === null) {
                                sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": I am having problems verifying your rank.");
                                deleteMessage(message);
                                return 0;
                            }
                            let resultLobbyHostId = null;

                            if (validRegions.includes(parsedCommand.args[0].toUpperCase())) {
                                let region = parsedCommand.args[0].toUpperCase();
                                // find host with most users not over 8 and join.

                                let lobbiesInLeagueChannel = lobbies.getLobbiesInChannel(leagueChannel);

                                if (Object.keys(lobbiesInLeagueChannel).length === 0) {
                                    if (leagueChannelRegion !== null) {
                                        sendChannelandMention(message.channel.id, message.author.id, "There are no lobbies currently. Use `!host` or `!host " + leagueChannelRegion.toLowerCase() + "` to host one!");
                                        return 0;
                                    } else {
                                        sendChannelandMention(message.channel.id, message.author.id, "There are no lobbies for that region currently. Use `!host " + region.toLowerCase() + "` to host one!");
                                        return 0
                                    }
                                }

                                let lobbiesFull = 0;

                                for (let currentHostId in lobbiesInLeagueChannel) {
                                    if (lobbiesInLeagueChannel.hasOwnProperty(currentHostId)) {
                                        let hostedLobby = lobbiesInLeagueChannel[currentHostId];
                                        if (hostedLobby.players.length < 8) {
                                            if (rank.mmr_level >= hostedLobby["rankRequirement"] && hostedLobby["region"] === region) {
                                                if (resultLobbyHostId === null) {
                                                    resultLobbyHostId = hostedLobby.host;
                                                } else {
                                                    if (hostedLobby.players.length > lobbiesInLeagueChannel[resultLobbyHostId].players.length) {
                                                        resultLobbyHostId = hostedLobby.host;
                                                    }
                                                }
                                            }
                                        } else if (hostedLobby.players.length === 8) {
                                            lobbiesFull++;
                                        }
                                    }
                                }

                                if (lobbiesFull === Object.keys(lobbiesInLeagueChannel).length) {
                                    sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": All lobbies full. Use `!host [region]` to host another lobby.");
                                    deleteMessage(message);
                                    return 0;
                                }

                                if (resultLobbyHostId === null) {
                                    sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Host does not exist or you can not join any lobbies (Maybe they are all full? Use `!host [region]` to host a new lobby). Make sure you have the required rank or a lobby for that region exists. Use `!join [@host]` or `!join [region]`.");
                                    deleteMessage(message);
                                    return 0;
                                }
                            }

                            let filter = null;

                            if (resultLobbyHostId === null) {
                                filter = {where: {discord: parseDiscordId(parsedCommand.args[0])}};
                            } else {
                                filter = {where: {steam: resultLobbyHostId}};
                            }

                            User.findOne(filter).then(function (hostUser) {
                                if (hostUser === null) {
                                    sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Host not found in database.");
                                    deleteMessage(message);
                                    return 0;
                                }
                                if (!lobbies.hasHostedLobbyInChannel(leagueChannel, hostUser.steam)) {
                                    sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Host not found. Use `!list` to see lobbies or `!host [region]` to start one!");
                                    deleteMessage(message);
                                    return 0;
                                }

                                let lobby = getLobbyForHost(leagueChannel, hostUser.steam);

                                if (lobby.players.length === 8) {
                                    sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": That Lobby is full. Use `!host [region]` to start another one.");
                                    deleteMessage(message);
                                    return 0;
                                }

                                let rankUpdate = {rank: rank.mmr_level, score: rank.score};
                                if (rank.score === null) delete rankUpdate["score"];
                                user.update(rankUpdate);
                                if (rank.mmr_level < leagueRequirements[leagueRole]) {
                                    sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\":You are not high enough rank to join lobbies in this league. (Your rank: " + getRankString(rank.mmr_level) + ", required league rank: " + getRankString(leagueRequirements[leagueRole]) + ")");
                                    deleteMessage(message);
                                    return 0;
                                }
                                if (rank.mmr_level < lobby["rankRequirement"]) {
                                    sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You are not high enough rank to join this lobby. (Your rank: " + getRankString(rank.mmr_level) + ", required lobby rank: " + getRankString(lobby["rankRequirement"]) + ")", true);
                                    deleteMessage(message);
                                    return 0;
                                }

                                lobby.players.push(user.steam);
                                lobby.lastactivity = Date.now();

                                getSteamPersonaNames([user.steam]).then(personaNames => {
                                    sendChannel(message.channel.id, "<@" + message.author.id + "> \"" + personaNames[user.steam] + "\" " + getRankString(rank.mmr_level) + " **joined** <@" + hostUser.discord + "> @" + lobby["region"] + " region lobby. `(" + lobby.players.length + "/8)`");
                                    sendDM(hostUser.discord, "<@" + message.author.id + "> \"" + personaNames[user.steam] + "\" " + getRankString(rank.mmr_level) + " **joined** your @" + lobby["region"] + " region lobby in <#" + message.channel.id + ">. `(" + lobby.players.length + "/8)`");
                                    sendDM(message.author.id, "<#" + message.channel.id + "> Lobby password for <@" + hostUser.discord + "> " + lobby["region"] + " region: `" + lobby["password"] + "`. Please join this lobby in Dota 2 Custom Games. If you cannot find the lobby, try refreshing in your Dota 2 client or whisper the host on Discord to create it <@" + hostUser.discord + ">.");
                                    if (lobby.players.length === 8) {
                                        sendChannel(message.channel.id, "**@" + lobby["region"] + " Lobby is full! <@" + hostUser.discord + "> can start the game with `!start`.**", false);
                                        sendDM(hostUser.discord, "**@" + lobby["region"] + " Lobby is full! You can start the game with `!start` in <#" + message.channel.id + ">.** \n(Only start the game if you have verified everyone in the game lobby. Use `!lobby` to see players.)");
                                    }
                                    deleteMessage(message);
                                });
                            });
                        });
                    })();
                    break;
                case "leave":
                case "quit":
                    (function () {
                        if (disableLobbyCommands === true) {
                            sendChannelandMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        let playerLobbyLeave = lobbies.getLobbyForPlayer(leagueChannel, user.steam);

                        if (playerLobbyLeave === null) {
                            sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You are not in any lobbies.");
                            deleteMessage(message);
                            return 0;
                        }
                        if (playerLobbyLeave.host === user.steam) {
                            sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Hosts should use `!cancel` instead of `!leave`.");
                            deleteMessage(message);
                            return 0;
                        }

                        let hostDiscordQuitId = playerLobbyLeave["host"];
                        User.findOne({where: {steam: hostDiscordQuitId}}).then(function (hostUser) {
                            if (lobbies.removePlayerFromLobby(leagueChannel, hostUser.steam, user.steam)) {
                                getSteamPersonaNames([user.steam]).then(personaNames => {
                                    let numPlayersLeft = lobbies.getLobbyForHost(leagueChannel, hostUser.steam).players.length;
                                    sendChannel(message.channel.id, "<@" + message.author.id + "> \"" + personaNames[user.steam] + "\" _**left**_ <@" + hostUser.discord + "> @" + playerLobbyLeave.region + " region lobby. `(" + numPlayersLeft + "/8)`");
                                    sendDM(hostUser.discord, "<@" + message.author.id + "> \"" + personaNames[user.steam] + "\" _**left**_ your @" + playerLobbyLeave.region + " region lobby in <#" + message.channel.id + ">. `(" + numPlayersLeft + "/8)`");
                                    deleteMessage(message);
                                });
                            }
                        });
                    })();
                    break;
                case "kick":
                    (function () {
                        if (disableLobbyCommands === true) {
                            sendChannelandMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        let hostLobby = getLobbyForHost(leagueChannel, user.steam);

                        if (hostLobby === null) {
                            sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You are not hosting any lobbies in <#" + message.channel.id + ">");
                            deleteMessage(message);
                            return 0;
                        }
                        if (parsedCommand.args.length < 1) {
                            sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You need to specify a player to kick: `!kick @quest`");
                            deleteMessage(message);
                            return 0;
                        }
                        let kickedPlayerDiscordId = parseDiscordId(parsedCommand.args[0]);

                        if (!message.guild.member(kickedPlayerDiscordId)) {
                            sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Could not find that user on this server.");
                            deleteMessage(message);
                            return 0;
                        }
                        User.findOne({where: {discord: kickedPlayerDiscordId}}).then(function (kickedPlayerUser) {
                            if (kickedPlayerUser === null) {
                                sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": User not in database. Make sure to use mentions in command: `!kick @username`");
                                deleteMessage(message);
                                return 0;
                            }
                            if (hostLobby.players.length === 1) {
                                sendChannelandMention(message.channel.id, message.author.id, "You can not kick the last player.");
                                return 0;
                            }
                            if (hostLobby.host === kickedPlayerUser.steam) {
                                sendChannelandMention(message.channel.id, message.author.id, "You can not kick yourself.");
                                return 0;
                            }
                            if (!hostLobby.players.includes(kickedPlayerUser.steam)) {
                                sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": User not in lobby.",);
                                deleteMessage(message);
                                return 0;
                            }

                            if (lobbies.removePlayerFromLobby(leagueChannel, user.steam, kickedPlayerUser.steam)) {
                                let kickUserName = message.client.users.find("id", kickedPlayerDiscordId);
                                sendChannelandMention(message.channel.id, message.author.id, "kicked " + kickUserName + " from <@" + user.discord + "> @" + hostLobby.region + " region lobby. `(" + lobbies.getLobbyForHost(leagueChannel, user.steam).players.length + "/8)`");
                                sendDM(kickedPlayerDiscordId, "<@" + user.discord + "> kicked you from their lobby in <#" + message.channel.id + ">.");
                            }
                        });
                    })();
                    break;
                case "list":
                case "lobbies":
                case "games":
                    (function () {
                        if (disableLobbyCommands === true) {
                            sendChannelandMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        // Get player info and print out current users in lobby.
                        let numPrinted = 0;

                        if (listratelimit.hasOwnProperty(leagueChannel)) {
                            if (Date.now() - listratelimit[leagueChannel] < 15000) {
                                sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": This command is currently rate limited in <#" + message.channel.id + ">.");
                                deleteMessage(message);
                                // rate limited
                                return 0;
                            }
                        }

                        let printFullList = false;
                        if (parsedCommand.args.length === 1 && (parsedCommand.args[0] === "full" || parsedCommand.args[0] === "all")) {
                            printFullList = true;
                        }

                        listratelimit[leagueChannel] = Date.now();

                        let lobbiesInLeagueChannel = lobbies.getLobbiesInChannel(leagueChannel);
                        for (let hostId in lobbiesInLeagueChannel) {
                            if (lobbiesInLeagueChannel.hasOwnProperty(hostId)) {
                                let lobby = lobbiesInLeagueChannel[hostId];
                                if (lobby.host !== null && lobby.password !== null) {
                                    let wheres = [];

                                    lobby.players.forEach(steamId => {
                                        wheres.push({steam: steamId});
                                    });

                                    User.findAll({where: {[Op.or]: wheres}}).then(players => {
                                        getSteamPersonaNames(lobby.players).then(personas => {
                                            let playerDiscordIds = [];
                                            let hostDiscord = "ERROR";
                                            let hostDiscordId = null;
                                            players.forEach(player => {
                                                if (player.steam !== lobby.host) {
                                                    playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam] + "\" " + getRankString(player.rank));
                                                } else {
                                                    hostDiscord = "<@" + player.discord + "> \"" + personas[player.steam] + "\" `" + getRankString(player.rank) + " **[Host]**";
                                                    hostDiscordId = player.discord;
                                                }
                                            });

                                            let lastActivityStr = "";
                                            let dontPrint = false;
                                            if (lobby.hasOwnProperty("lastactivity")) {
                                                let lastActivity = Math.round((Date.now() - new Date(lobby.lastactivity)) / 1000 / 60);
                                                if (lastActivity >= 2) {
                                                    lastActivityStr = " (" + lastActivity + "m last activity)";
                                                }
                                                if (!dontPrint && lastActivity > 15 && !exemptLeagueRolePruning.includes(leagueRole)) {
                                                    lobbies.deleteLobby(leagueChannel, lobby.host);
                                                    dontPrint = true;
                                                    sendChannel(message.channel.id, "_*** @" + lobby.region + " <@" + hostDiscordId + "> lobby has been removed because of no activity (joins/leaves) for more than 15 minutes._");
                                                    sendDM(hostDiscordId, "**Your lobby in <#" + message.channel.id + "> was cancelled because of no activity (joins/leaves) for more than 15 minutes.**");
                                                }
                                                if (!dontPrint && lastActivity > 5 && lobby.players.length === 8 && !exemptLeagueRolePruning.includes(leagueRole)) {
                                                    lobbies.deleteLobby(leagueChannel, lobby.host);
                                                    dontPrint = true;
                                                    sendChannel(message.channel.id, "_*** @" + lobby.region + " <@" + hostDiscordId + "> lobby has been removed because it is full and has had no activity (joins/leaves) for more than 5 minutes._");
                                                    sendDM(hostDiscordId, "**Your lobby in <#" + message.channel.id + "> was cancelled because it was full and had no activity (joins/leaves) for more than 5 minutes. Please use `!start` if the game was loaded in the Dota 2 Client next time.**");
                                                }
                                            }
                                            let lobbyTime = Math.round((Date.now() - new Date(lobby.starttime)) / 1000 / 60);
                                            if (!dontPrint && lobbyTime > 60 && !exemptLeagueRolePruning.includes(leagueRole)) {
                                                lobbies.deleteLobby(leagueChannel, lobby.host);
                                                dontPrint = true;
                                                sendChannel(message.channel.id, "_*** @" + lobby.region + " <@" + hostDiscordId + "> lobby has been removed because it has not started after 60 minutes._");
                                                sendDM(hostDiscordId, "**Your lobby in <#" + message.channel.id + "> was cancelled because it was not started after 60 minutes. Please use `!start` if the game was loaded in the Dota 2 Client next time.**");
                                            }

                                            let fullStr = "";
                                            if (lobby.players.length >= 8) {
                                                fullStr = "~~";
                                            }

                                            if (!dontPrint) {
                                                if (printFullList === true) {
                                                    sendChannel(message.channel.id, fullStr + "=== **@" + lobby.region + "** [" + getRankString(lobby.rankRequirement) + "+] `(" + lobby.players.length + "/8)` " + hostDiscord + " | " + playerDiscordIds.join(" | ") + ". (" + lobbyTime + "m)" + lastActivityStr + fullStr);
                                                } else {
                                                    sendChannel(message.channel.id, fullStr + "=== **@" + lobby.region + "** [" + getRankString(lobby.rankRequirement) + "+] `(" + lobby.players.length + "/8)` " + hostDiscord + " | " + "Use \"!join <@" + hostDiscordId + ">\" to join lobby. (" + lobbyTime + "m)" + lastActivityStr + fullStr);
                                                }
                                            }
                                        });
                                    });
                                }
                            }
                            numPrinted++;
                        }
                        if (numPrinted === 0) {
                            if (leagueChannelRegion !== null) {
                                sendChannelandMention(message.channel.id, message.author.id, "There are no lobbies currently. Use `!host` or `!host " + leagueChannelRegion.toLowerCase() + "` to host one!");
                                return 0;
                            } else {
                                sendChannelandMention(message.channel.id, message.author.id, "There are no lobbies for that region currently. Use `!host [region]` to host one!");
                                return 0;
                            }
                        }
                    })();
                    break;
                case "lobby":
                    (function () {
                        if (disableLobbyCommands === true) {
                            sendChannelandMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }
                        if (parsedCommand.args.length === 0) {
                            // sendChannelandMention(message.channel.id, message.author.id, "You need to specify a host.");
                            // return 0;
                            parsedCommand.args[0] = '<@' + message.author.id + '>';
                        }
                        let lobbyHostDiscordId = parseDiscordId(parsedCommand.args[0]);

                        // if (!message.guild.member(lobbyHostDiscordId)) {
                        //     sendChannelandMention(message.channel.id, message.author.id, "Could not find that user on this server.");
                        //     return 0;
                        // }
                        User.findOne({where: {discord: lobbyHostDiscordId}}).then(hostUser => {
                            let lobby = lobbies.getLobbyForPlayer(leagueChannel, hostUser.steam);

                            if (lobby === null) {
                                sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": That user/you are is not hosting any lobbies.");
                                deleteMessage(message);
                                return 0;
                            }

                            if (lobby.host !== null && lobby.password !== null) {
                                let wheres = [];

                                lobby.players.forEach(steamId => {
                                    wheres.push({steam: steamId});
                                });
                                User.findAll({where: {[Op.or]: wheres}}).then(players => {
                                    getSteamPersonaNames(lobby.players).then(personas => {
                                        let playerDiscordIds = [];
                                        let hostDiscord = "ERROR";
                                        let hostDiscordId = null;
                                        players.forEach(player => {
                                            if (player.steam !== lobby.host) {
                                                playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam] + "\" " + getRankString(player.rank));
                                            } else {
                                                hostDiscord = "<@" + player.discord + "> \"" + personas[player.steam] + "\" " + getRankString(player.rank) + " **[Host]**";
                                                hostDiscordId = player.discord;
                                            }
                                        });

                                        let lastActivityStr = "";
                                        if (lobby.hasOwnProperty("lastacitivity")) {
                                            let lastActivity = Math.round((Date.now() - new Date(lobby.lastactivity)) / 1000 / 60);
                                            if (lastActivity > 5) {
                                                lastActivityStr = " (" + +"m last activity)";
                                            }
                                        }
                                        sendChannelandMention(message.channel.id, message.author.id, "=== **@" + lobby.region + "** [" + getRankString(lobby.rankRequirement) + "+] `(" + lobby.players.length + "/8)` " + hostDiscord + " | " + playerDiscordIds.join(" | ") + ". (" + Math.round((Date.now() - new Date(lobby.starttime)) / 1000 / 60) + "m)" + lastActivityStr);
                                        // also whisper
                                        sendDM(message.author.id, "=== **@" + lobby.region + "** [" + getRankString(lobby.rankRequirement) + "+] `(" + lobby.players.length + "/8)` " + hostDiscord + " | " + playerDiscordIds.join(" | ") + ". (" + Math.round((Date.now() - new Date(lobby.starttime)) / 1000 / 60) + "m)" + lastActivityStr);
                                        deleteMessage(message);
                                    });
                                });
                            }
                        });
                    })();
                    break;
                case "cancel":
                case "close":
                case "end":
                case "unhost":
                    // TODO: DM all players if a lobby they were in was cancelled?
                    (function () {
                        if (disableLobbyCommands === true) {
                            sendChannelandMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        let hostLobbyEnd = getLobbyForHost(leagueChannel, user.steam);

                        if (hostLobbyEnd === null) {
                            sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You are not hosting any lobbies in <#" + message.channel.id + ">");
                            deleteMessage(message);
                            return 0;
                        }
                        let regionEnd = hostLobbyEnd["region"];

                        if (lobbies.isHostOfHostedLobby(leagueChannel, user.steam)) {
                            lobbies.deleteLobby(leagueChannel, user.steam);
                            sendChannel(message.channel.id, "<@" + user.discord + "> @" + regionEnd + " region **lobby cancelled**.");
                            return 0;
                        }
                    }());
                    break;
                case "getpassword":
                case "password":
                case "pass":
                case "sendpassword":
                case "sendpass":
                    (function () {
                        if (disableLobbyCommands === true) {
                            sendChannelandMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        let playerSendPassLobby = lobbies.getLobbyForPlayer(leagueChannel, user.steam);

                        if (playerSendPassLobby === null) {
                            sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You are not in any lobbies.");
                            deleteMessage(message);
                            return 0;
                        }


                        User.findOne({where: {steam: playerSendPassLobby.host}}).then(function (hostUser) {
                            if (hostUser === null) {
                                sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Host not found in database.");
                                deleteMessage(message);
                                return 0;
                            }
                            if (!lobbies.hasHostedLobbyInChannel(leagueChannel, hostUser.steam)) {
                                sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Host not found. Use `!list` to see lobbies or `!host [region]` to start one!");
                                deleteMessage(message);
                                return 0;
                            }

                            let lobby = lobbies.getLobbyForHost(leagueChannel, hostUser.steam);
                            sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Lobby password for <@" + hostUser.discord + "> " + lobby["region"] + " region: `" + lobby["password"] + "`. Please join this lobby in Dota 2 Custom Games. If you cannot find the lobby, whisper the host on Discord to create it <@" + hostUser.discord + ">.");
                            deleteMessage(message);

                        });
                    })();
                    break;
                default:
                    (function () {
                        // sendChannelandMention(message.channel.id, message.author.id, "Unhandled bot message: " + message.content);
                        // console.log("Unhandled bot message for lobby: " + message.content);
                        isLobbyCommand = false;
                    })();
            }
        }

        let isBotCommand = true;

        switch (parsedCommand.command) {
            case "unlink":
                (function () {
                    if (message.channel.type === "dm") {
                        sendChannelandMention(message.channel.id, message.author.id, "I can not unlink steam id in direct messages. Please try in <#542465986859761676>.");
                        return 0;
                    }
                    if (user !== null && user.steam !== null) {
                        user.update({steam: null, steamLinkToken: null, validated: null});
                        // steamFriends.removeFriend(user.steam);
                        // console.log("Removed steam friends " + user.steam);

                        let ranks = [];

                        leagueRoles.forEach(leagueRole => {
                            if (message.guild === null) {
                                sendChannelandMention(message.channel.id, message.author.id, "Something went wrong! I can not update your roles. Are you directly messaging me? Please use <#542465986859761676>.");
                            }
                            let roleObj = message.guild.roles.find(r => r.name === leagueRole);

                            if (roleObj !== null) {
                                ranks.push({
                                    name: leagueRole,
                                    rank: leagueRequirements[leagueRole],
                                    role: message.guild.roles.find(r => r.name === leagueRole),
                                })
                            }
                        });
                        let removed = [];

                        if (message.member === null) {
                            sendChannelandMention(message.channel.id, message.author.id, "I am having a problem seeing your roles. Are you set to Invisible on Discord?");
                        }
                        ranks.forEach(r => {
                            if (message.member.roles.has(r.role.id)) {
                                message.member.removeRole(r.role).catch(logger.error);
                                removed.push(r.name);
                            }
                        });
                        if (removed.length > 0) {
                            sendChannelandMention(message.channel.id, message.author.id, "I have removed the following roles from you: `" + removed.join("`, `") + "`");
                        }

                        sendChannelandMention(message.channel.id, message.author.id, "You have successfully unlinked your account. Use `!link [Steam64 ID]` to link steam id. See <#542454956825903104> for more information.");
                    } else {
                        sendChannelandMention(message.channel.id, message.author.id, "You have not linked a steam id. See <#542454956825903104> for more information.");
                    }
                })();
                break;
            case "link":
                (function () {
                    if (message.channel.type === "dm") {
                        sendChannelandMention(message.channel.id, message.author.id, "I can not link steam id in direct messages. Please try in <#542465986859761676>.");
                        return 0;
                    }
                    // this version does not do linking and assumes validated by default
                    const steamIdLink = parsedCommand.args[0];

                    if (steamIdLink === undefined) {
                        sendChannelandMention(message.channel.id, message.author.id, 'Invalid arguments. The commands is `!link [Steam64 ID]`. See <#542494966220587038> for help.');
                        return 0;
                    }

                    if (steamIdLink.includes("[") || steamIdLink.includes("STEAM") || steamIdLink.length < 12) {
                        sendChannelandMention(message.channel.id, message.author.id, "**WARNING** That looks like an invalid steam id. Make sure you are using the \"Steam64 ID\". See <#542494966220587038> for help.");
                    }

                    if (!parseInt(steamIdLink)) {
                        sendChannelandMention(message.channel.id, message.author.id, 'Invalid steam id. See <#542494966220587038> for help.');
                        return 0;
                    }

                    // const token = randtoken.generate(6);

                    User.findAll({where: {steam: steamIdLink}}).then(existingUsers => {
                        let playerDiscordIds = [];

                        // TODO: recheck ranks here
                        existingUsers.forEach(player => {
                            playerDiscordIds.push("<@" + player.discord + ">");
                        });

                        if ((user === null && existingUsers.length > 0) || (user !== null && existingUsers.length >= 1)) {
                            sendChannelandMention(message.channel.id, message.author.id, "**WARNING!** Could not link that steam id. The steam id `" + steamIdLink + "` has already been linked to these accounts: " + playerDiscordIds.join(", ") + ". See <#542494966220587038> for help.");
                            return 0;
                        }

                        if (user === null) {
                            User.create({
                                discord: message.author.id,
                                steam: steamIdLink,
                                validated: true,
                            }).then(test => {
                                // logger.info(test.toJSON());
                                sendChannelandMention(message.channel.id, message.author.id, "I have linked your steam id `" + steamIdLink + "`. If I do not promote you right away then you probably used the wrong steam id or you are set to Invisible on Discord.");
                                updateRoles(message, test, true, false);
                            }).catch(function (error) {
                                logger.error("error " + error);
                            });
                        } else {
                            user.update({steam: steamIdLink, validated: true}).then(test => {
                                sendChannelandMention(message.channel.id, message.author.id, "I have linked your steam id `" + steamIdLink + "`. If I do not promote you right away then you probably used the wrong steam id or you are set to Invisible on Discord.");
                                updateRoles(message, test, true, false);
                            });
                        }
                    });
                })();
                break;
            case "adminrestartbot":
            case "restartbot":
            case "suicide":
            case "killyourself":
            case "die":
            case "getouttahere":
            case "seppuku":
                (function () {
                    if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;
                    disableLobbyCommands = true;

                    lobbies.backupLobbies(logger);

                    let famousLastWords = [
                        "Hey fellas! How about this for a headline for tomorrow’s paper? ‘French fries.'",
                        "What the devil do you mean to sing to me, priest? You are out of tune.",
                        "Good. A woman who can fart is not dead.",
                        "I’d hate to die twice. It’s so boring.",
                        "I did not get my Spaghetti-O’s; I got spaghetti. I want the press to know this.",
                        "I’d like to thank the Academy for my lifetime achievement award that I will eventually get.",
                        "I knew it! I knew it! Born in a hotel room and, goddamn it, dying in a hotel room.",
                        "And now for a final word from our sponsor—.",
                        "Remember, Honey, don’t forget what I told you. Put in my coffin a deck of cards, a mashie niblick, and a pretty blonde.",
                        "Damn it! Don’t you dare ask God to help me!",
                        "Yeah, country music.",
                        "Bring me a bullet-proof vest.",
                        "Surprise me.",
                        "Thank god. I’m tired of being the funniest person in the room.",
                        "I’ve had 18 straight whiskeys... I think that’s the record.",
                        "They couldn’t hit an elephant at this dist—",
                        "On the contrary.",
                        "I should have never switched from scotch to martinis.",
                        "I am sorry to bother you chaps. I don’t know how you get along so fast with the traffic on the roads these days.",
                        "Now is not the time for making new enemies.",
                        "I’m looking for loopholes.",
                        "This wallpaper and I are fighting a duel to the death. Either it goes or I do.",
                        "Gun’s not loaded… see?",
                        "Am I dying, or is this my birthday?",
                        "Oh, you young people act like old men. You have no fun.",
                        "Codeine... bourbon...",
                        "No.",
                        "I’m bored with it all.",
                        "This is no way to live.",
                        "I desire to go to Hell and not to Heaven. In the former I shall enjoy the company of popes, kings and princes, while in the latter are only beggars, monks and apostles.",
                        "Turn me over — I’m done on this side.",
                        "Now why did I do that?",
                        "Don’t let it end like this. Tell them I said something important.",
                        // "Oh Lord, forgive the misprints!",
                        // "All right, then, I’ll say it: Dante makes me sick.",
                        "I'll be back!",
                        "Yes, master.",
                        "Sentences are the building blocks of paragraphs.",
                        "Beep boop, I am a robot. Haha just kidding!",
                        "Sometimes it's better to remain silent and be thought a fool, rather than open your mouth and remove all doubt.",
                        "Mitochondria is the powerhouse of the cell",
                        "Beep boop, I am a :pepega: Haha not kidding :pepega:",
                    ];
                    sendChannelandMention(message.channel.id, message.author.id, famousLastWords[Math.floor(Math.random() * famousLastWords.length)]);
                    setTimeout(function () {
                        process.exit(1);
                    }, 1000);
                })();
                break;
            case "admindisablebot":
            case "disablebot":
                (function () {
                    if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                    if (disableLobbyCommands === false) {
                        disableLobbyCommands = true;

                        lobbies.backupLobbies(logger);
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, lobby commands disabled. Lobby data saved.");
                        return 0;
                    } else {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, I am not enabled!");
                    }
                })();
                break;
            case "adminenablebot":
            case "enablebot":
                (function () {
                    if (message.author.id !== "204094307689431043") {
                        return 0; // no permissions
                    }
                    if (disableLobbyCommands === true) {
                        disableLobbyCommands = false;

                        lobbies.restoreLobbiesSafe();
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, Lobby data loaded. Lobby commands enabled.");
                        return 0;
                    } else {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, I am not disabled.");
                    }
                })();
                break;
            case "admintogglehost":
            case "togglehost":
                (function () {
                    if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                    if (disableLobbyHost === true) {
                        disableLobbyHost = false;
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, lobby hosting enabled.");
                    } else {
                        disableLobbyHost = true;
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, lobby hosting disabled.");
                    }
                })();
                break;
            case "adminsavelobbies":
            case "savelobbies":
                (function () {
                    if (message.author.id !== "204094307689431043") {
                        return 0; // no permissions
                    }
                    lobbies.backupLobbies(logger);
                    sendChannelandMention(message.channel.id, message.author.id, "Sir, lobby data saved.");
                })();
                break;
            case "adminlobbyinfo":
            case "lobbyinfo":
                (function () {
                    if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                    sendChannelandMention(message.channel.id, message.author.id, "disableLobbyCommands: " + disableLobbyCommands + ", " + "disableLobbyHost: " + disableLobbyHost);
                    // add lobby sizes
                })();
                break;
            case "adminclearlobbies":
            case "clearlobbies":
                (function () {
                    if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                    if (parsedCommand.args.length !== 1) {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, invalid argument, try: `!adminclearlobbies " + leagueRoles.join(", ") + "`.");
                        return 0;
                    }
                    let role = parsedCommand.args[0];

                    if (!leagueRoles.includes(role)) {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, invalid League, try:" + leagueRoles.join(", "));
                    }

                    lobbies.resetLobbies(role);
                    sendChannelandMention(message.channel.id, message.author.id, "Sir, I cleared " + role + " lobbies.");

                    lobbies.backupLobbies(logger);
                })();
                break;
            case "addlobby":
                (function () {
                    if (message.author.id !== "204094307689431043") return 0; // no permissions

                    lobbies.resetLobbies(parsedCommand.args[0]);
                    sendChannelandMention(message.channel.id, message.author.id, "OK.");
                })();
                break;
            case "removelobby":
                (function () {
                    if (message.author.id !== "204094307689431043") {
                        return 0; // no permissions
                    }

                    lobbies.removeLobbies(parsedCommand.args[0]);
                    sendChannelandMention(message.channel.id, message.author.id, "OK.");
                })();
                break;
            case "adminupdatelink":
            case "adminlink":
                (function () {
                    if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                    if (parsedCommand.args.length < 1) {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, the command is `!adminupdatelink [@discord] [[steamid]]`");
                        return 0;
                    }
                    let linkPlayerDiscordId = parseDiscordId(parsedCommand.args[0]);

                    User.findOne({where: {discord: linkPlayerDiscordId}}).then(function (linkPlayerUser) {
                        if (linkPlayerUser === null) {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, I could not find that user in the database. This command is for updating links, the user must link themselves first.");
                            return 0;
                        }
                        let steamId = null;
                        if (parsedCommand.args.length > 1) {
                            steamId = parsedCommand.args[1];
                        } else {
                            steamId = linkPlayerUser.steam;
                        }
                        linkPlayerUser.update({steam: steamId, steamLinkToken: null}).then(function (result) {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, I have linked steam id " + steamId + " to <@" + linkPlayerUser.discord + ">.");
                            return 0;
                        }, function (error) {
                            logger.error(error);
                        });
                    });
                })();
                break;
            case "adminupdateroles":
                (function () {
                    if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                    if (message.channel.type === "dm") {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, I can not update roles in direct messages. Please try in a channel on the server.");
                        return 0;
                    }
                    if (parsedCommand.args.length < 1) {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, the command is `!adminlink [@discord] [[steamid]]`");
                        return 0;
                    }
                    let updateRolePlayerDiscordId = parseDiscordId(parsedCommand.args[0]);

                    User.findOne({where: {discord: updateRolePlayerDiscordId}}).then(function (playerUser) {
                        if (playerUser === null) {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, I could not find that user.");
                            return 0;
                        }
                        updateRoles(message, playerUser, true, true);
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, trying to update roles for <@" + playerUser.discord + ">.");
                    });
                })();
                break;
            case "admincreatelink":
                (function () {
                    if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                    if (parsedCommand.args.length < 1) {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, the command is `!adminlink [@discord] [[steamid]]`");
                        return 0;
                    }
                    let createLinkPlayerDiscordId = parseDiscordId(parsedCommand.args[0]);
                    let forceSteamIdLink = parsedCommand.args[1];

                    User.findOne({where: {discord: createLinkPlayerDiscordId}}).then(function (linkPlayerUser) {
                        if (linkPlayerUser === null) {
                            User.create({
                                discord: createLinkPlayerDiscordId,
                                steam: forceSteamIdLink,
                                validated: true,
                            }).then(test => {
                                // logger.info(test.toJSON());
                                sendChannelandMention(message.channel.id, message.author.id, "Sir, I have linked <@" + createLinkPlayerDiscordId + "> steam id `" + forceSteamIdLink + "`. Remember they will not have any roles. Use `!adminupdateroles [@discord]`.");
                            }).catch(function (msg) {
                                logger.error("error " + msg);
                            });
                        } else {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, <@" + createLinkPlayerDiscordId + ") is already linked to steam id `" + linkPlayerUser.steam + "`. Use `!adminupdatelink [@discord] [steam]` instead.");
                            return 0;
                        }
                    });
                })();
                break;
            case "adminunlink":
                (function () {
                    if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                    if (parsedCommand.args.length !== 1) {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, the command is `!adminunlink [@discord]`");
                        return 0;
                    }
                    let unlinkPlayerDiscordId = parseDiscordId(parsedCommand.args[0]);

                    User.findOne({where: {discord: unlinkPlayerDiscordId}}).then(function (unlinkPlayerUser) {
                        let oldSteamID = unlinkPlayerUser.steam;
                        unlinkPlayerUser.update({steam: null, validated: false}).then(function (result) {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, I have unlinked <@" + unlinkPlayerUser.discord + ">'s steam id. `" + oldSteamID + "`");
                        }, function (error) {
                            logger.error(error);
                        });
                    });
                })();
                break;
            case "adminunlinksteam":
                (function () {
                    if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                    if (parsedCommand.args.length !== 1) {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, the command is `!adminunlink [steamid]`");
                        return 0;
                    }
                    if (!parseInt(parsedCommand.args[0])) {
                        sendChannelandMention(message.channel.id, message.author.id, 'Sir, that is an invalid steam id');
                        return 0;
                    }
                    let unlinkPlayerSteamId = parsedCommand.args[0];

                    User.findAll({where: {steam: unlinkPlayerSteamId}}).then(function (unlinkPlayerUsers) {
                        unlinkPlayerUsers.forEach(unlinkPlayerUser => {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, I have unlinked <@" + unlinkPlayerUser.discord + ">'s steam id.");
                            unlinkPlayerUser.update({steam: null, validated: false});
                        });
                    });
                })();
                break;
            case "admingetsteam":
            case "getsteam":
            case "gets":
                (function () {
                    if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                    if (parsedCommand.args.length !== 1) {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, the command is `!admingetsteam [@discord]`");
                        return 0;
                    }
                    let infoPlayerDiscordId = parseDiscordId(parsedCommand.args[0]);

                    if (infoPlayerDiscordId === null) {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, that is an invalid Discord ID. Make sure it is a mention (blue text).");
                        return 0;
                    }

                    User.findOne({where: {discord: infoPlayerDiscordId}}).then(function (infoPlayerUser) {
                        if (infoPlayerUser === null) {
                            // todo infoPlayerUser is null here
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, I did not find any matches in database for <@" + infoPlayerUser.discord + ">");
                            return 0;
                        }
                        if (infoPlayerUser.steam === null) {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, I could not find a steam id for <@" + infoPlayerUser.discord + ">. This user has tried to link a steam id and has probably unlinked it.");
                            return 0;
                        }
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, <@" + infoPlayerUser.discord + "> is linked to steam id: `" + infoPlayerUser.steam + "`.");
                    });
                })();
                break;
            case "admingetdiscord":
            case "getdiscord":
            case "getd":
                (function () {
                    if (!message.member.roles.has(message.guild.roles.find(r => r.name === adminRoleName).id)) return 0;

                    if (parsedCommand.args.length !== 1) {
                        sendChannelandMention(message.channel.id, message.author.id, "Sir, the command is `!admingetdiscord [steam]`");
                        return 0;
                    }
                    const steamId = parsedCommand.args[0];

                    if (!parseInt(steamId)) {
                        sendChannelandMention(message.channel.id, message.author.id, 'Sir, that is an invalid steam id');
                        return 0;
                    }

                    User.findAll({where: {steam: steamId}}).then(players => {
                        let playerDiscordIds = [];

                        // TODO: recheck ranks here
                        players.forEach(player => {
                            playerDiscordIds.push("<@" + player.discord + "> `<@" + player.discord + ">`");
                        });

                        if (playerDiscordIds.length >= 1) {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, I found these users for `" + steamId + "`: " + playerDiscordIds.join(", ") + ".");
                        } else {
                            sendChannelandMention(message.channel.id, message.author.id, "Sir, I did not find any matches in database for `" + steamId + "`.");
                        }
                    });
                })();
                break;
            case "getrank":
            case "checkrank":
            case "rank":
                (function () {
                    if (parsedCommand.args.length === 1) {
                        let getRankUserDiscordId = parseDiscordId(parsedCommand.args[0]);

                        if (getRankUserDiscordId !== null) {
                            if (!message.guild.member(getRankUserDiscordId)) {
                                sendChannelandMention(message.channel.id, message.author.id, "Could not find that user on this server.");
                                return 0;
                            }
                            User.findOne({where: {discord: getRankUserDiscordId}}).then(getRankUser => {
                                if (getRankUser === null) {
                                    sendChannelandMention(message.channel.id, message.author.id, "That user has not linked a steam id yet.");
                                    return 0;
                                }
                                getRankFromSteamId(getRankUser.steam).then(rank => {
                                    if (rank === null) {
                                        sendChannelandMention(message.channel.id, message.author.id, "I am having problems verifying your rank.");
                                        return 0;
                                    }

                                    let MMRStr = "";
                                    if (rank.score !== null) {
                                        MMRStr =  " MMR is: `" + rank.score + "`.";
                                    }
                                    sendChannelandMention(message.channel.id, message.author.id, "Current rank for <@" + getRankUser.discord + "> is: `" + getRankString(rank.mmr_level) + "`." + MMRStr);

                                    if (leagueLobbies.includes(message.channel.name)) {
                                        deleteMessage(message);
                                    }
                                    return 0;
                                });
                            });
                        } else if (parseInt(parsedCommand.args[0])) {
                            let publicSteamId = parsedCommand.args[0];

                            getRankFromSteamId(publicSteamId).then(rank => {
                                if (rank === null) {
                                    sendChannelandMention(message.channel.id, message.author.id, "I am having problems verifying your rank.");
                                    return 0;
                                }

                                let MMRStr = "";
                                if (rank.score !== null) {
                                    MMRStr =  " MMR is: `" + rank.score + "`.";
                                }
                                sendChannelandMention(message.channel.id, message.author.id, "Current rank for " + publicSteamId + " is: " + getRankString(rank.mmr_level) + "." + MMRStr);

                                if (leagueLobbies.includes(message.channel.name)) {
                                    deleteMessage(message);
                                }
                                return 0;
                            });
                        } else {
                            sendChannelandMention(message.channel.id, message.author.id, "Invalid arguments.");
                        }
                    } else {
                        if (user !== null && user.steam !== null && user.steamLinkToken === null) {
                            getRankFromSteamId(user.steam).then(rank => {
                                if (rank === null) {
                                    sendChannelandMention(message.channel.id, message.author.id, "I am having problems verifying your rank.");
                                    return 0;
                                }

                                let MMRStr = "";
                                if (rank.score !== null) {
                                    MMRStr =  " MMR is: `" + rank.score + "`. ";
                                }
                                sendChannelandMention(message.channel.id, message.author.id, "Your current rank is: " + getRankString(rank.mmr_level) + "." + MMRStr);
                                let rankUpdate = {rank: rank.mmr_level, score: rank.score};
                                if (rank.score === null) delete rankUpdate["score"];
                                user.update(rankUpdate).then(nothing => {
                                    if (leagueLobbies.includes(message.channel.name)) {
                                        updateRoles(message, nothing, false, false, true);
                                    } else {
                                        updateRoles(message, nothing, false, false, false);
                                    }
                                });
                            });
                        } else {
                            sendChannelandMention(message.channel.id, message.author.id, "You have not linked a steam id. See <#542454956825903104> for more information.");
                        }
                    }
                })();
                break;
            case "removerole":
                (function () {
                    // TODO;
                })();
                break;
            case "getsteampersona":
            case "steampersona":
            case "getp":
                (function () {
                    if (parsedCommand.args.length === 1) {
                        let getSteamPersonaUserDiscordId = parseDiscordId(parsedCommand.args[0]);

                        if (getSteamPersonaUserDiscordId !== null) {
                            if (!message.guild.member(getSteamPersonaUserDiscordId)) {
                                sendChannelandMention(message.channel.id, message.author.id, "Could not find that user on this server.");
                                return 0;
                            }
                            User.findOne({where: {discord: getSteamPersonaUserDiscordId}}).then(getSteamPersonaUser => {
                                getSteamPersonaNames([getSteamPersonaUser.steam]).then(personas => {
                                    sendChannelandMention(message.channel.id, message.author.id, "<@" + getSteamPersonaUser.discord + "> Steam Name is \"" + personas[getSteamPersonaUser.steam] + "\"");
                                });
                            });
                        } else {
                            sendChannelandMention(message.channel.id, message.author.id, "Invalid arguments.");
                        }
                    }
                })();
                break;
            case "updateroles":
            case "updaterole":
            case "updateranks":
            case "udpaterank":
            case "roles":
            case "role":
                (function () {
                    if (message.channel.type === "dm") {
                        sendChannelandMention(message.channel.id, message.author.id, "I can not update roles in direct messages. Please try in <#542465986859761676>.");
                        return 0;
                    }
                    if (leagueLobbies.includes(message.channel.name)) {
                        updateRoles(message, user, true, true, true);
                    } else {
                        updateRoles(message, user, true, true, false);
                    }
                })();
                break;
            case "help":
                (function () {
                    sendChannelandMention(message.channel.id, message.author.id, "See <#542454956825903104> for more information.");
                })();
                break;
            case "staffhelp":
            case "shelp":
            case "sh":
                (function () {
                    if (parsedCommand.args.length === 0) {
                        sendDM(message.author.id, "Sir, the command is !staffhelp [@discord] [topic] [[language]].");
                        deleteMessage(message);
                        return 0;
                    }
                    let staffHelpUserDiscordId = parseDiscordId(parsedCommand.args[0]);
                    if (staffHelpUserDiscordId === null) {
                        sendDM(message.author.id, "Sir, that is an invalid Discord ID.  Make sure it is a mention (blue text).");
                        deleteMessage(message);
                        return 0;
                    }

                    if (staffHelpUserDiscordId !== null) {
                        if (!message.guild.member(staffHelpUserDiscordId)) {
                            sendDM(message.author.id, "Sir, I could not find that user on this server.");
                            deleteMessage(message);
                            return 0;
                        }
                    }

                    let lang = parsedCommand.args[2];
                    if (lang === null) {
                        lang = "en";
                    }

                    let topic = parsedCommand.args[1];
                    let helptext = "";

                    switch(topic) {
                        case "tony":
                            helptext = {
                                "en": "Tony is a pepega, don't complain about losing if you go him.",
                                "ru": "Russian here",
                            }[lang];
                            break;
                        default:
                            sendDM(message.author.id, "Could not find that help topic.");
                            deleteMessage(message);
                            return 0;
                    }

                    sendChannelandMention(message.channel.id, staffHelpUserDiscordId, helptext);
                })();
                break;
            default:
                (function () {
                    isBotCommand = false;
                })();
        }

        if (isBotCommand === false && message.channel.type !== "dm") {
            // This means the command was a lobby command.
            if (isLobbyCommand === null && !leagueLobbies.includes(message.channel.name)) {
                sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You can not use lobby commands in this channel.");
                deleteMessage(message);
                return 0;
            }
            if (isLobbyCommand === false) {
                logger.info("Unhandled bot message: " + message.content);
                sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": I was not able to process this command. Please read <#542454956825903104> for command list. Join <#542494966220587038> for help from staff.");
                deleteMessage(message);
                return 0;
            }
        }
    });
});

discordClient.login(config.discord_token);
