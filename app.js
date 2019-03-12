const config = require("./config");

const PromClient = require('prom-client');
const express = require('express');
const app = express();

app.get('/metrics', (req, res) => {
    res.end(PromClient.register.metrics());
});
app.listen(3000);

const metrics = require("./metrics");
metrics.startCollection();

const Discord = require('discord.js');

const dacService = require('./dac-service.js');

const mc = require('./message-consolidator');
// Send consolidated messages at configured speed
mc.startMessageFlushCron();

const DiscordUtil = require('./discord-util.js');

let discordClients = [];
let discordUtils = [];

for(let i = 0; i < config.discord_tokens.length; i++) {
    discordClients[i] = new Discord.Client();
    discordUtils[i] = new DiscordUtil(discordClients[i]);
}

const randtoken = require("rand-token");

const logger = require('./logger.js');

const request = require('request');
const User = require('./schema/user.js');
const VerifiedSteam = require('./schema/verified-steam.js');
const Tournament = require('./schema/tournament.js');
const {commands, commandsByName} = require('./command/all-commands.js');

const Lobbies = require("./lobbies.js"),
    lobbies = new Lobbies();
lobbies.restoreLobbies();
lobbies.startBackupJob();

PREFIX = "!cb ";

let botDownMessage = "Bot is restarting. Lobby commands are currently disabled. Be back in a second!";

let adminRoleName = config.adminRoleName;
let leagueRoles = config.leagueRoles;
let leagueToLobbiesPrefix = config.leagueToLobbiesPrefix;
let leagueRequirements = config.leagueRequirements;
let validRegions = config.validRegions;
let exemptLeagueRolePruning = config.exemptLeagueRolePruning;
let botChannels = config.botChannels;
let listratelimit = {};
let disableLobbyCommands = false;
let disableLobbyHost = false;

let activeTournament = 1;

let leagueLobbies = [];
let leagueChannelToRegion = {};
let lobbiesToLeague = {};
let leagueRoleIdsByRole = {};
let leagueRoleIdsByRegion = {};
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

let lobbyPasswordPrefixes = [];
validRegions.forEach(region => {
    lobbyPasswordPrefixes.push(region.toLowerCase() + "_");
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


function getRank(rank) {
    if (rank === 0) { return {name: "Unranked"}; }
    if (rank > 0 && rank <= 9) { return {icon: "♟", name: "Pawn", level: (rank).toString()}; }
    if (rank >= 10 && rank < (10 + 9)) { return {icon: "♞", name: "Knight", level: (rank - 9).toString()}; }
    if (rank >= (10 + 9) && rank < (10 + 9 + 9)) { return {icon: "♝", name: "Bishop", level: (rank - 9 - 9).toString()}; }
    if (rank >= (10 + 9 + 9) && rank < (10 + 9 + 9 + 9)) { return {icon: "♜", name: "Rook", level: (rank - 9 - 9 - 9).toString()}; }
    if (rank >= (10 + 9 + 9 + 9) && rank < (10 + 9 + 9 + 9 + 1)) { return {icon: "♚", name: "King"}; }
    if (rank >= (10 + 9 + 9 + 9 + 1)) { return {icon: "♛", name: "Queen"}; }
    // if (rank >= (10 + 9 + 9 + 9) && rank < (10 + 9 + 9 + 9 + 1)) { return "King-" + (rank - 9 - 9 - 9 - 9).toString(); }
    // if (rank >= (10 + 9 + 9 + 9 + 1)) { return "Queen-" + (rank - 9 - 9 - 9 - 9 - 1).toString(); }
    return "ERROR";
}

function getRankString(rank) {
    let rankData = getRank(rank);
    let iconStr = "";
    if (rankData.hasOwnProperty("icon")) {
        iconStr = rankData.icon + " ";
    }
    if (rankData.hasOwnProperty("icon") && rankData.hasOwnProperty("name")) {
        if (rankData.hasOwnProperty("level")) {
            return iconStr + "**" + rankData.name + "-" + rankData.level + "**";
        } else {
            return iconStr + "**" + rankData.name + "**";
        }
    }
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

function getLobbyForHost(serverID, leagueChannel, host) {
    return lobbies.getLobbyForHostSafe(serverID, leagueChannel, host);
}

function getSteamPersonaNames(steamIds) {
    return new Promise(function(resolve, reject) {

        const end = metrics.steamRequestHistogram.startTimer();
        request("http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=" + config.steam_token + "&steamids=" + steamIds.join(","), { json: true}, (err, res, body) => {
            end();

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

                                personaNames[player["steamid"]] = player["personaname"].replace(/`/g, '');
                            }
                        }

                        metrics.steamRequestSuccessCounter.inc();
                        resolve(personaNames);
                    } catch (error) {
                        metrics.steamRequestErrorCounter.inc();
                        logger.error(error.message + " " + error.stack);
                    }
                } else {
                    metrics.steamRequestErrorCounter.inc();
                }
            } else {
                metrics.steamRequestErrorCounter.inc();
            }
        });
    });

}

function getSteamProfiles(steamIds) {
    return new Promise(function(resolve, reject) {

        const end = metrics.dacRequestHistogram.startTimer();
        request("http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=" + config.steam_token + "&steamids=" + steamIds.join(","), { json: true}, (err, res, body) => {
            end();

            if (err) { reject(err); }

            if (res !== undefined && res.hasOwnProperty("statusCode")) {
                if (res.statusCode === 200) {
                    try {
                        // logger.info("Got result from server: " + JSON.stringify(body.response));

                        let personaNames = {};

                        for (let playerKey in body.response.players) {
                            if (body.response.players.hasOwnProperty(playerKey)) {
                                let player = body.response.players[playerKey];
                                player["personaname"] = player["personaname"].replace(/`/g, '');

                                personaNames[player["steamid"]] = player;
                            }
                        }

                        metrics.steamRequestSuccessCounter.inc();
                        resolve(personaNames);
                    } catch (error) {
                        logger.error(error.message + " " + error.stack);
                    }
                } else {
                    metrics.steamRequestErrorCounter.inc();
                }
            } else {
                metrics.steamRequestErrorCounter.inc();
            }
        });
    });
}

function updateRoles(discordClient, discordUtil, message, user, notifyOnChange=true, notifyNoChange=false, shouldDeleteMessage=false) {
    if (user !== null && user.steam !== null) {
        dacService.getRankFromSteamId(user.steam).then(rank => {
            if(rank === null) {
                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "I am having problems verifying your rank.");
                return 0;
            }
            if (message.channel.type === "dm") {
                return 0; // can't update roles in DM.
            }
            if (message.guild === null) {
                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Something went wrong! I can not update your roles. Are you directly messaging me? Please use <#" + discordClient.channels.find(c => c.name === config.channels["chessbot-commands"]).id + ">.");
                return 0;
            }
            let ranks = [];

            leagueRoles.forEach(leagueRole => {
                let roleObj = leagueRoleIdsByRole[leagueRole];

                if (roleObj !== null) {
                    ranks.push({
                        name: leagueRole,
                        rank: leagueRequirements[leagueRole],
                        role: leagueRoleIdsByRole[leagueRole],
                    })
                }
            });

            let roleNamesToAdd = [];
            let roleNamesToRemove = [];
            let roleIdsToAdd = [];
            let roleIdsToRemove = [];

            let discordUser = message.guild.members.get(user.discord);

            if (discordUser === null) {
                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "I am having a problem seeing your roles. Are you set to Invisible on Discord?");
            } else {
                ranks.forEach(r => {
                    if (r.role !== undefined && r.role.hasOwnProperty("id")) {
                        if (discordUser.roles.has(r.role.id)) {
                            if (rank.mmr_level < r.rank) {
                                roleIdsToRemove.push(r.role.id);
                                roleNamesToRemove.push(r.name);
                            }
                        } else {
                            if (rank.mmr_level >= r.rank) {
                                roleIdsToAdd.push(r.role.id);
                                roleNamesToAdd.push(r.name);
                            }
                        }
                    }
                });

                let rankStr = getRankString(rank.mmr_level);
                if (rankStr === "ERROR") {
                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "I had a problem getting your rank, did you use the right steam id? See <#" + discordClient.channels.find(c => c.name === config.channels["readme"]).id + "> for more information.");
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
                    MMRStr = " MMR is: `" + rank.score + "`. ";
                }

                function handleRoleUpdatePromise() {
                    // always show and whisper about demotions in case they cannot see the channel anymore
                    if (roleNamesToRemove.length > 0) {
                        // discordUtil.sendChannelAndMention(message.channel.id, message.author.id, messagePrefix + " rank is " + rankStr + "." + MMRStr + messagePrefix2 + " demoted from: `" + removed.join("`, `") + "` (sorry!)");
                        discordUtil.sendDM(message.author.id, messagePrefix + " rank is " + rankStr + "." + MMRStr + messagePrefix2 + " demoted from: `" + roleNamesToRemove.join("`, `") + "` (sorry!)");
                    }

                    if (notifyOnChange) {
                        if (roleNamesToAdd.length > 0) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, messagePrefix + " rank is " + rankStr + "." + MMRStr + messagePrefix2 + " promoted to: `" + roleNamesToAdd.join("`, `") + "`");
                        }
                    }
                }

                if (roleNamesToAdd.length === 0 && roleNamesToRemove.length === 0) {
                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, messagePrefix + " rank is " + rankStr + "." + MMRStr + " No role changes based on your rank.");
                } else {
                    // not sure why I can't used Promise.all but I tried
                    let rolePromise;
                    if (roleIdsToAdd.length > 0) {
                        rolePromise = discordUser.addRoles(roleIdsToAdd);
                    }
                    if (roleIdsToRemove.length > 0) {
                        rolePromise = discordUser.removeRoles(roleIdsToRemove);
                    }

                    rolePromise.then(handleRoleUpdatePromise).catch(error => {
                        logger.error(error);

                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "I am having problems updating your roles.");
                        return 0;
                    });
                }
            }

            if (shouldDeleteMessage) {
                discordUtil.deleteMessage(message);
            }
            return 0;
        });
    } else if (user !== null && user.steam === null) {
        // todo cleanup after most people are verified.
        let discordUser = message.guild.members.get(user.discord);
        leagueRoles.forEach(leagueRole => {
            let role = message.guild.roles.find(r => r.name === leagueRole);
            discordUser.removeRole(role).catch(logger.error);
        })
    }
}

function handleReady(discordClient, discordUtil) {
    logger.info(`Logged in as ${discordClient.user.tag}!`);
    try {
        discordUtil.sendChannel(discordClient.channels.find(c => c.name === config.channels["staff-bot"]).id, "I am back!", false);
    } catch(err) {
        logger.error(err);
    }
}


for(let i = 0; i < config.discord_tokens.length; i++) {
    console.log("CLIENT: " + discordClients[i]);
    console.log("UTIL: " + discordUtils[i]);

    discordClients[i].on('ready', _ => handleReady(discordClients[i], discordUtils[i]));
    discordClients[i].on('error', logger.error);
    discordClients[i].on('message', message => handleMsg(message, discordClients[i], discordUtils[i]));
    discordClients[i].on('rateLimit', r => {
        let channelId = r.path.match("[0-9]+")[0];
        let channel = discordClients[i].channels.get(channelId);
        if (r.path.includes("channel")) {
            channelId = " <#" + channelId + ">";
        }
        console.log(discordClients[i].user.tag + ": RATE LIMITED " + r.requestLimit + " " + r.timeDifference + "ms " + r.method + " " + r.path);
        discordUtils[i].sendChannel(discordClients[i].channels.find(c => c.name === config.channels["chessbot-warnings"]).id, discordClients[i].user.tag + ": RATE LIMITED " + r.requestLimit + " " + r.timeDifference + "ms " + r.method + " " + r.path + channelId + " " + channel.name);
    })
}

function handleMsg(message, discordClient, discordUtil) {
    // Override validRegions if a server ID and validRegion was specifically defined

    if (message.channel.type !== "dm") {
        if (Object.keys(config.server_config).includes(message.member.guild.id)) {
            validRegions = config.server_config[message.member.guild.id]["validRegions"];
        }
    }

    // should be on 'ready' but guild is null for some reason
    let guild = message.guild;
    if (Object.keys(leagueRoleIdsByRole).length === 0) {
        leagueRoles.forEach(leagueRole => {
            let role1 = guild.roles.find(r => r.name === leagueRole);
            if (role1 !== null && role1.hasOwnProperty("id")) {
                console.log("Server " + message.guild.name + ": Role " + role1.name + " found: Caching. -- " + role1);
                leagueRoleIdsByRole[leagueRole] = role1;
            } else {
                console.log("Server " + message.guild.name + ": Error caching league role: " + leagueRole + " -- " + role1);
            }
        });
        validRegions.forEach(leagueRegion => {
            let role2 = guild.roles.find(r => r.name === leagueRegion);
            if (role2 !== null && role2.hasOwnProperty("id")) {
                leagueRoleIdsByRegion[leagueRegion] = role2.id;
                console.log("Server " + message.guild.name + ": Role " + role2.name + " found. Caching. -- " + role2);
            } else {
                console.log("Server " + message.guild.name + ": Error caching region role: " + leagueRegion + " -- " + role2);
            }
        });
    }


    let adminRoleId;
    if (message.guild !== null && message.guild.roles.find(r => r.name === adminRoleName) !== null) {
        adminRoleId = message.guild.roles.find(r => r.name === adminRoleName).id;
    } else {
        // Silently fail if admin role is not present on server
        adminRoleId = 0;
    }

    if (message.author.bot === true) {
        return 0; // ignore bot messages
    }

    if (message.channel.type === "dm") {
        // nothing
    }

    // delete and "warn" users about posting lobby passwords.
    lobbyPasswordPrefixes.forEach(prefix => {
        if (message.content.match(new RegExp("\\b" + prefix + "([a-zA-Z0-9]{5})\\b"))) {
            let text = "Please _DO NOT_ post lobby passwords given out by ChessBot in any channel. Your message was deleted. Attempting to bypass this will result in a ban.";
            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, text);
            discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> " + text);
            discordUtil.sendChannel(discordClient.channels.find(c => c.name === config.channels["chessbot-warnings"]).id, "<@" + message.author.id + "> posted a lobby password in <#" + message.channel.id + ">.\nMessage content: " + message.content);
            discordUtil.deleteMessage(message);
            return 0;
        }
    });

    if (!(message.content.substring(0, PREFIX.length) === PREFIX || message.content.substring(0, 1) === "!")) {
        // logger.debug("Non-bot message: " + message.content);
        return 0;
    }

    logger.info(" *** Received command: " + message.content);

    let parsedCommand = parseCommand(message);

    let metricsChannelId;
    let metricsChannelName;
    if (message.channel.type === "dm") {
        metricsChannelId = "dm";
        metricsChannelName = "dm";
    } else {
        metricsChannelId = message.channel.id;
        metricsChannelName = message.channel.name;
    }

    metrics.commandInvocation.inc({"channel_name": metricsChannelName, "channel_id": metricsChannelId, "name": parsedCommand.command});
    // not sure if this one is useful
    // metrics.commandInvocationArgs.inc({"channel": metricsChannel, "name": parsedCommand.command, "args": parsedCommand.args.join(" ")});

    if (message.channel.type !== "dm" && (message.member === null || message.guild === null)) {
        discordUtil.sendDM(message.author.id, "Error! Are you set to invisible mode?");
        logger.error("message.member: " + message.member + " or message.guild " + message.guild + " was null " + message.author.id + ": " + message.author.username + "#" + message.author.discriminator);

        return 0;
    }

    if (message.channel.type !== "dm" && message.member.roles.has(adminRoleId)) {
        // if we can see user roles (not a DM) and user is staff, continue
    } else if (message.channel.type !== "dm" && !leagueLobbies.includes(message.channel.name) && !botChannels.includes(message.channel.name)) {
        // otherwise if command was not typed in a whitelisted channel
        discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> You cannot use bot commands in this channel. Try <#" + discordClient.channels.find(c => c.name === config.channels["chessbot-commands"]).id + ">.");
        discordUtil.deleteMessage(message);
        return 0;
    }

    if (commandsByName.hasOwnProperty(parsedCommand.command)) {
        commandsByName[parsedCommand.command]
            .execute(message, parsedCommand.args)
            .then(result => discordUtil.handle(message, result))
            .catch(logger.error);
        return 0;
    }

    let userPromise = User.findByDiscord(message.author.id);

    userPromise.then(user => {
        let isLobbyCommand = null;

        if (user === null ||user.steam === null) {
            const readme = discordClient.channels.find(c => c.name === config.channels['readme']).id;
            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, `You need to complete verification to use bot commands. See <#${readme}> for more information.`);
            updateRoles(discordClient, discordUtil, message, user, false, false, true);
            return 0;
        }

        if (leagueLobbies.includes(message.channel.name)) {
            // Add lobby to lobbies data if it doesn't exist
            if (lobbies.getLobbiesInChannel(message.member.guild.id, message.channel.name) === undefined) {
                lobbies.resetLobbies(message.member.guild.id, message.channel.name);
            }
            let leagueRole = lobbiesToLeague[message.channel.name];
            let leagueChannel = message.channel.name;
            let leagueChannelRegion = leagueChannelToRegion[leagueChannel];

            switch (parsedCommand.command) {
                case "admincancel":
                case "adminclose":
                case "adminend":
                case "adminunhost":
                    (function () {
                        if (!message.member.roles.has(adminRoleId)) return 0;

                        if (parsedCommand.args.length !== 1) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, the command is `!admincancel [@host]`");
                        }

                        let hostLobbyDiscordId = parseDiscordId(parsedCommand.args[0]);
                        User.findByDiscord(hostLobbyDiscordId).then(hostUser => {
                            let hostLobbyEnd = getLobbyForHost(message.member.guild.id, leagueChannel, hostUser.steam);
                            if (hostLobbyEnd === null) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, <@" + hostUser.discord + "> is not hosting any lobby.");
                            }
                            else {
                                let regionEnd = hostLobbyEnd["region"];

                                lobbies.deleteLobby(message.member.guild.id, leagueChannel, hostUser.steam);
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, I cancelled <@" + hostUser.discord + ">'s lobby for @" + regionEnd + ".");
                                discordUtil.sendDM(hostUser.discord, "**Your lobby in <#" + message.channel.id + " was cancelled by an admin.**");
                            }
                        });
                    })();
                    break;
                case "adminkick":
                    (function () {
                        if (!message.member.roles.has(adminRoleId)) return 0;

                        if (parsedCommand.args.length !== 2) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, the command is `!adminkick [@host] [@player]`.");
                            return 0;
                        }
                        let hostDiscordIdKick = parseDiscordId(parsedCommand.args[0]);
                        let playerDiscordIdKick = parseDiscordId(parsedCommand.args[1]);

                        if (hostDiscordIdKick === null) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, that host id is invalid.");
                        }
                        if (playerDiscordIdKick === null) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, that player id is invalid.");
                        }

                        User.findByDiscord(hostDiscordIdKick).then(hostUser => {
                            User.findByDiscord(playerDiscordIdKick).then(playerUser => {
                                let hostLobby = getLobbyForHost(message.member.guild.id, leagueChannel, hostUser.steam);
                                if (hostLobby === null) {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, that person is not hosting a lobby currently.");
                                    return 0;
                                }
                                if (hostUser.steam === playerUser.steam) {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, you can not kick the host from their own lobby. Use `!admincancel [@host]` instead.");
                                    return 0;
                                }

                                lobbies.removePlayerFromLobby(message.member.guild.id, leagueChannel, hostUser.steam, playerUser.steam);
                                let kickUserName = discordClient.guild.members.get(playerUser.discord);
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "kicked " + kickUserName + " from <@" + hostUser.discord + "> @" + hostLobby.region + " region lobby. `(" + getLobbyForHost(message.member.guild.id, leagueChannel, hostUser.steam).players.length + "/8)`");
                                discordUtil.sendDM(playerUser.discord, "<#" + message.channel.id + "> An admin kicked you from <@" + hostUser.discord + "> @" + hostLobby.region + " region lobby.");

                            });
                        });
                    })();
                    break;
                case "host":
                    (function () {
                        if (user === null) {
                            // TODO
                        }

                        if (disableLobbyCommands === true) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }
                        if (disableLobbyHost === true) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Lobby hosting disabled. Bot is going down for maintenance.");
                        }

                        let hostLobbyExist = getLobbyForHost(message.member.guild.id, leagueChannel, user.steam);

                        if (hostLobbyExist !== null) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "You are already hosting a lobby. Type `!lobby` to see players.");
                            return 0;
                        }
                        if (parsedCommand.args.length === 0) {
                            if (leagueChannelRegion !== null) {
                                parsedCommand.args[0] = leagueChannelRegion;
                            } else {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Invalid arguments. Try `!host [" + validRegions.join(', ').toLowerCase() + "] [rank-1]`. Example: `!host nae bishop-1`. (no spaces in rank)");
                                return 0;
                            }
                        }

                        let region = parsedCommand.args[0].toUpperCase();

                        if (leagueChannelRegion !== null && leagueChannelRegion !== region) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "You can only host " + leagueChannelRegion + " region lobbies in this channel.");
                            return 0;
                        }

                        let rankRequirement;
                        if (leagueRequirements.hasOwnProperty(leagueRole)) {
                            rankRequirement = leagueRequirements[leagueRole];

                            if (parsedCommand.args.length === 1) {
                                rankRequirement = leagueRequirements[leagueRole];
                            } else if (parsedCommand.args.length === 2) {
                                rankRequirement = parseRank(parsedCommand.args[1]);

                                if (rankRequirement === null) {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Invalid rank requirement. Example: `!host " + region.toLowerCase() + " bishop-1`. (no spaces in rank)");
                                    return 0;
                                }
                            } else if (parsedCommand.args.length > 2) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Invalid arguments. Must be `!host [" + validRegions.join(', ').toLowerCase() + "] [rank-1]`. Example: `!host nae bishop-1`. (no spaces in rank)");
                                return 0;
                            }
                        } else {
                            rankRequirement = 1; // For lobbies that don't have a rank requirement set in the config
                        }

                        if (!validRegions.includes(region.toUpperCase())) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Invalid arguments. Must be `!host [" + validRegions.join(', ').toLowerCase() + "] [rank-1]`. Example: `!host nae bishop-1`. (no spaces in rank)");
                            return 0;
                        }

                        // create lobby
                        dacService.getRankFromSteamId(user.steam).then(rank => {
                            if (rank === null) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "I am having problems verifying your rank.");
                                return 0;
                            }
                            let rankUpdate = {rank: rank.mmr_level, score: rank.score};
                            if (rank.score === null) delete rankUpdate["score"];
                            user.update(rankUpdate);
                            let minHostRankRestrictions = rank.mmr_level - 2;
                            if (rank.mmr_level < leagueRequirements[leagueRole] && rank.mmr_level !== leagueRequirements[leagueRole]) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "You are not high enough rank to host this lobby. (Your rank: " + getRankString(rank.mmr_level) + ", required rank: " + getRankString(leagueRequirements[leagueRole]) + ")");
                                return 0;
                            }
                            if (rank.mmr_level < rankRequirement && rank.mmr_level !== leagueRequirements[leagueRole]) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "You are not high enough rank to host this lobby. (Your rank: " + getRankString(rank.mmr_level) + ", required rank: " + getRankString(rankRequirement) + ")");
                                return 0;
                            }
                            if (rankRequirement > minHostRankRestrictions && rankRequirement > leagueRequirements[leagueRole] && rank.mmr_level !== leagueRequirements[leagueRole]) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "You are not high enough rank to host this lobby. The highest rank restriction you can make is 2 ranks below your current rank. (Your rank: " + getRankString(rank.mmr_level) + ", highest allowed rank restriction: " + getRankString(minHostRankRestrictions) + ")");
                                return 0;
                            }
                            // good to start
                            let token = randtoken.generate(5);
                            let newLobby = lobbies.createLobby(message.member.guild.id, leagueChannel, user.steam, region, rankRequirement, token);

                            // let currentLobby = getLobbyForPlayer(leagueChannel, user.steam);

                            let regionStr = "@" + region;
                            if (leagueRoleIdsByRegion.hasOwnProperty(region)) {
                                regionStr = "<@&" + leagueRoleIdsByRegion[region] + ">";
                            }

                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "**=== " + regionStr + " Lobby started by <@" + user.discord + ">** " + getRankString(rank.mmr_level) + ". **Type `!join @" + message.author.username + "#" + message.author.discriminator + "` to join!** [" + getRankString(newLobby["rankRequirement"]) + " required to join] \nThe bot will whisper you the password on Discord. Make sure you are allowing direct messages from server members in your Discord Settings. \nPlease _DO NOT_ post lobby passwords in any channel. You will be banned.");
                            discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> **Please host a private Dota Auto Chess lobby in @" + region + " region with the following password:** `" + newLobby["password"] + "`\nPlease remember to double check people's ranks and make sure the right ones joined the game before starting. \nYou can see the all players in the lobby by using `!lobby` in the channel. \nWait until the game has started in the Dota 2 client before typing `!start`. \nIf you need to kick a player from the Discord lobby that has not joined your Dota 2 lobby or if their rank changed, use `!kick @player` in the channel.");
                        });
                    })();
                    break;
                case "start":
                    (function () {
                        if (disableLobbyCommands === true) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        // check 8/8 then check all ranks, then send passwords
                        let lobby = lobbies.getLobbyForHost(message.member.guild.id, leagueChannel, user.steam);

                        if (lobby === undefined || lobby === null) {
                            discordUtil.sendDM(message.author.id, "You are not hosting any lobbies in <#" + message.channel.id + ">");
                            discordUtil.deleteMessage(message);
                            return 0;
                        }

                        // if (parsedCommand.args.length > 0) { // TODO: DRY
                        //     let force = parsedCommand.args[0];
                        //
                        //     if (force !== "force") {
                        //         discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Invalid arguments");
                        //         return 0;
                        //     }
                        //     if (lobby.players.length < 2) {
                        //         discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "You need at least 2 players to force start a lobby. `(" + lobby.players.length + "/8)`");
                        //         return 0;
                        //     }
                        //
                        //     User.findAllUsersWithSteamIdsIn(lobby.players).then(players => {
                        //         getSteamPersonaNames(lobby.players).then(personas => {
                        //             let playerDiscordIds = [];
                        //             let hostUserDiscordId = null;
                        //
                        //             players.forEach(player => {
                        //                 if (player.steam !== lobby.host) {
                        //                     playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam] + "\" " + getRankString(player.rank) + "");
                        //                 } else {
                        //                     playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam] + "\" " + getRankString(player.rank) + " **[Host]**");
                        //                     hostUserDiscordId = player.discord;
                        //                 }
                        //             });
                        //
                        //             lobbies.deleteLobby(message.member.guild.id, leagueChannel, user.steam);
                        //
                        //             discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "**@" + lobby.region + " region lobby started. Good luck!** " + playerDiscordIds.join(" | "));
                        //         });
                        //     });
                        // } else {
                            if (lobby.players.length === 8) {
                                User.findAllUsersWithSteamIdsIn(lobby.players).then(players => {
                                    getSteamPersonaNames(lobby.players).then(personas => {
                                        let playerDiscordIds = [];
                                        let hostUserDiscordId = null;

                                        players.forEach(player => {
                                            if (player.steam !== lobby.host) {
                                                playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam] + "\" " + getRankString(player.rank));
                                            } else {
                                                playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam] + "\" " + getRankString(player.rank) + " **[Host]**");
                                                hostUserDiscordId = player.discord;
                                            }
                                        });

                                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "**@" + lobby["region"] + " region lobby started. Good luck!** " + playerDiscordIds.join(" | "));
                                        lobbies.deleteLobby(message.member.guild.id, leagueChannel, user.steam);
                                    });
                                });
                            } else {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Not enough players to start yet. `(" + lobby.players.length + "/8)`");
                            }
                        // }
                    })();
                    break;
                case "join":
                    (function () {
                        if (disableLobbyCommands === true) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        let playerLobbyJoin = lobbies.getLobbyForPlayer(message.member.guild.id, leagueChannel, user.steam);

                        if (playerLobbyJoin !== null) {
                            discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You are already in a lobby! Use `!leave` to leave.");
                            discordUtil.deleteMessage(message);
                            return 0;
                        }
                        if (parsedCommand.args.length === 0) {
                            if (leagueChannelRegion === null) {
                                discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Need to specify a host or region to join.");
                                discordUtil.deleteMessage(message);
                                return 0;
                            } else {
                                parsedCommand.args[0] = leagueChannelRegion;
                            }
                        }

                        dacService.getRankFromSteamId(user.steam).then(rank => {
                            if (rank === null) {
                                discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": I am having problems verifying your rank.");
                                discordUtil.deleteMessage(message);
                                return 0;
                            }
                            let resultLobbyHostId = null;

                            if (validRegions.includes(parsedCommand.args[0].toUpperCase())) {
                                let region = parsedCommand.args[0].toUpperCase();
                                // find host with most users not over 8 and join.

                                let lobbiesInLeagueChannel = lobbies.getLobbiesInChannel(message.member.guild.id, leagueChannel);

                                if (Object.keys(lobbiesInLeagueChannel).length === 0) {
                                    if (leagueChannelRegion !== null) {
                                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "There are no lobbies currently. Use `!host` or `!host " + leagueChannelRegion.toLowerCase() + "` to host one!");
                                        return 0;
                                    } else {
                                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "There are no lobbies for that region currently. Use `!host " + region.toLowerCase() + "` to host one!");
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
                                                        // Join the highest rated lobby
                                                        if (hostedLobby.rankRequirement > lobbiesInLeagueChannel[resultLobbyHostId].rankRequirement) {
                                                            resultLobbyHostId = hostedLobby.host;
                                                        }
                                                    }
                                                }
                                            }
                                        } else if (hostedLobby.players.length === 8) {
                                            lobbiesFull++;
                                        }
                                    }
                                }

                                if (lobbiesFull === Object.keys(lobbiesInLeagueChannel).length) {
                                    discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": All lobbies full. Use `!host [region]` to host another lobby.");
                                    discordUtil.deleteMessage(message);
                                    return 0;
                                }

                                if (resultLobbyHostId === null) {
                                    discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Host does not exist or you can not join any lobbies (Maybe they are all full? Use `!host [region]` to host a new lobby). Make sure you have the required rank or a lobby for that region exists. Use `!join [@host]` or `!join [region]`.");
                                    discordUtil.deleteMessage(message);
                                    return 0;
                                }
                            }

                            let userPromise = null;

                            if (resultLobbyHostId === null) {
                                userPromise = User.findByDiscord(parseDiscordId(parsedCommand.args[0]));
                            } else {
                                userPromise = User.findOneBySteam(resultLobbyHostId);
                            }

                            userPromise.then(function (hostUser) {
                                if (hostUser === null) {
                                    discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Host not found in database.");
                                    discordUtil.deleteMessage(message);
                                    return 0;
                                }
                                if (!lobbies.hasHostedLobbyInChannel(message.member.guild.id, leagueChannel, hostUser.steam)) {
                                    discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Host not found. Use `!list` to see lobbies or `!host [region]` to start one!");
                                    discordUtil.deleteMessage(message);
                                    return 0;
                                }

                                let lobby = getLobbyForHost(message.member.guild.id, leagueChannel, hostUser.steam);

                                if (lobby.players.length === 8) {
                                    discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": That Lobby is full. Use `!host [region]` to start another one.");
                                    discordUtil.deleteMessage(message);
                                    return 0;
                                }

                                let rankUpdate = {rank: rank.mmr_level, score: rank.score};
                                if (rank.score === null) delete rankUpdate["score"];
                                user.update(rankUpdate);
                                if (rank.mmr_level < leagueRequirements[leagueRole]) {
                                    discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\":You are not high enough rank to join lobbies in this league. (Your rank: " + getRankString(rank.mmr_level) + ", required league rank: " + getRankString(leagueRequirements[leagueRole]) + ")");
                                    discordUtil.deleteMessage(message);
                                    return 0;
                                }
                                if (rank.mmr_level < lobby["rankRequirement"]) {
                                    discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You are not high enough rank to join this lobby. (Your rank: " + getRankString(rank.mmr_level) + ", required lobby rank: " + getRankString(lobby["rankRequirement"]) + ")", true);
                                    discordUtil.deleteMessage(message);
                                    return 0;
                                }

                                lobby.players.push(user.steam);
                                lobby.lastactivity = Date.now();

                                let lobbiesInLeagueChannel = lobbies.getLobbiesInChannel(message.member.guild.id, leagueChannel);

                                getSteamPersonaNames([user.steam]).then(personaNames => {
                                    discordUtil.sendDM(hostUser.discord, "<@" + message.author.id + "> \"" + personaNames[user.steam] + "\" " + getRankString(rank.mmr_level) + " **joined** your @" + lobby["region"] + " region lobby in <#" + message.channel.id + ">. `(" + lobby.players.length + "/8)`");
                                    discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> Lobby password for <@" + hostUser.discord + "> " + lobby["region"] + " region: `" + lobby["password"] + "`\nPlease join this lobby in Dota 2 Custom Games. If you can not find the lobby, try refreshing in your Dota 2 client or whisper the host on Discord to create it <@" + hostUser.discord + ">.");
                                    if (lobby.players.length === 8) {
                                        discordUtil.sendChannel(message.channel.id, "**@" + lobby["region"] + " Lobby is full! <@" + hostUser.discord + "> can start the game with `!start`.**");
                                        discordUtil.sendDM(hostUser.discord, "**@" + lobby["region"] + " Lobby is full! You can start the game with `!start` in <#" + message.channel.id + ">.** \n(Only start the game if you have verified everyone in the game lobby. Use `!lobby` to see players.)");
                                    }
                                    if (Object.keys(lobbiesInLeagueChannel).length < 10) { // don't print joins if large number of lobbies
                                        discordUtil.sendChannel(message.channel.id, "<@" + message.author.id + "> \"" + personaNames[user.steam] + "\" " + getRankString(rank.mmr_level) + " **joined** <@" + hostUser.discord + "> @" + lobby["region"] + " region lobby. `(" + lobby.players.length + "/8)`");
                                        discordUtil.deleteMessage(message);
                                    }
                                });
                            });
                        });
                    })();
                    break;
                case "leave":
                case "quit":
                    (function () {
                        if (disableLobbyCommands === true) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        let playerLobbyLeave = lobbies.getLobbyForPlayer(message.member.guild.id, leagueChannel, user.steam);

                        if (playerLobbyLeave === null) {
                            discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You are not in any lobbies.");
                            discordUtil.deleteMessage(message);
                            return 0;
                        }
                        if (playerLobbyLeave.host === user.steam) {
                            discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Hosts should use `!cancel` instead of `!leave`.");
                            discordUtil.deleteMessage(message);
                            return 0;
                        }

                        let lobbiesInLeagueChannel = lobbies.getLobbiesInChannel(message.member.guild.id, leagueChannel);

                        let hostDiscordQuitId = playerLobbyLeave["host"];
                        User.findOneBySteam(hostDiscordQuitId).then(function (hostUser) {
                            if (lobbies.removePlayerFromLobby(message.member.guild.id, leagueChannel, hostUser.steam, user.steam)) {
                                getSteamPersonaNames([user.steam]).then(personaNames => {
                                    let numPlayersLeft = lobbies.getLobbyForHost(message.member.guild.id, leagueChannel, hostUser.steam).players.length;

                                    discordUtil.sendDM(hostUser.discord, "<@" + message.author.id + "> \"" + personaNames[user.steam] + "\" _**left**_ your @" + playerLobbyLeave.region + " region lobby in <#" + message.channel.id + ">. `(" + numPlayersLeft + "/8)`");
                                    if (Object.keys(lobbiesInLeagueChannel).length < 10) { // don't reply to message if large number of users
                                        discordUtil.sendChannel(message.channel.id, "<@" + message.author.id + "> \"" + personaNames[user.steam] + "\" _**left**_ <@" + hostUser.discord + "> @" + playerLobbyLeave.region + " region lobby. `(" + numPlayersLeft + "/8)`");
                                        discordUtil.deleteMessage(message);
                                    }
                                });
                            }
                        });
                    })();
                    break;
                case "kick":
                    (function () {
                        if (disableLobbyCommands === true) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        let hostLobby = getLobbyForHost(message.member.guild.id, leagueChannel, user.steam);

                        if (hostLobby === null) {
                            discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You are not hosting any lobbies in <#" + message.channel.id + ">");
                            discordUtil.deleteMessage(message);
                            return 0;
                        }
                        if (parsedCommand.args.length < 1) {
                            discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You need to specify a player to kick: `!kick @quest`");
                            discordUtil.deleteMessage(message);
                            return 0;
                        }
                        let kickedPlayerDiscordId = parseDiscordId(parsedCommand.args[0]);

                        if (!message.guild.member(kickedPlayerDiscordId)) {
                            discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Could not find that user on this server.");
                            discordUtil.deleteMessage(message);
                            return 0;
                        }
                        User.findByDiscord(kickedPlayerDiscordId).then(function (kickedPlayerUser) {
                            if (kickedPlayerUser === null) {
                                discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": User not in database. Make sure to use mentions in command: `!kick @username`");
                                discordUtil.deleteMessage(message);
                                return 0;
                            }
                            if (hostLobby.players.length === 1) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "You can not kick the last player.");
                                return 0;
                            }
                            if (hostLobby.host === kickedPlayerUser.steam) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "You can not kick yourself. (Use !cancel to cancel a lobby you have hosted)");
                                return 0;
                            }
                            if (!hostLobby.players.includes(kickedPlayerUser.steam)) {
                                discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": User not in lobby.",);
                                discordUtil.deleteMessage(message);
                                return 0;
                            }

                            if (lobbies.removePlayerFromLobby(message.member.guild.id, leagueChannel, user.steam, kickedPlayerUser.steam)) {
                                let kickUserName = message.client.users.find("id", kickedPlayerDiscordId);
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "kicked " + kickUserName + " from <@" + user.discord + "> @" + hostLobby.region + " region lobby. `(" + lobbies.getLobbyForHost(message.member.guild.id, leagueChannel, user.steam).players.length + "/8)`");
                                discordUtil.sendDM(kickedPlayerDiscordId, "<@" + user.discord + "> kicked you from their lobby in <#" + message.channel.id + ">.");
                            }
                        });
                    })();
                    break;
                case "list":
                case "lobbies":
                case "games":
                    (function () {
                        if (disableLobbyCommands === true) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        let lobbiesInLeagueChannel = lobbies.getLobbiesInChannel(message.member.guild.id, leagueChannel);

                        // if number of lobbies is large, cancel them faster
                        let lobbyTimeout1 = 15; // timeout for no activity
                        let lobbyTimeout2 = 60; // max time
                        let lobbyListRateLimit = 15000;
                        if (lobbiesInLeagueChannel.length > 5) {
                            lobbyTimeout1 = 10;
                            lobbyTimeout2 = 30;
                            lobbyListRateLimit = 20000;
                        }
                        if (lobbiesInLeagueChannel.length > 8) {
                            lobbyTimeout1 = 5;
                            lobbyTimeout2 = 15;
                            lobbyListRateLimit = 25000;
                        }

                        // Get player info and print out current users in lobby.
                        let numPrinted = 0;

                        if (listratelimit.hasOwnProperty(message.member.guild.id + "-" + leagueChannel)) {
                            if (Date.now() - listratelimit[message.member.guild.id + "-" + leagueChannel] < lobbyListRateLimit && !message.member.roles.has(adminRoleId)) {
                                discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": This command is currently rate limited in <#" + message.channel.id + ">.");
                                discordUtil.deleteMessage(message);
                                // rate limited
                                return 0;
                            }
                        }

                        let printFullList = false;
                        if (parsedCommand.args.length === 1 && (parsedCommand.args[0] === "full" || parsedCommand.args[0] === "all")) {
                            printFullList = true;
                        }

                        listratelimit[message.member.guild.id + "-" + leagueChannel] = Date.now();

                        discordUtil.sendChannel(message.channel.id, "**__LOBBY LIST__ - Use `!lobby` to display players in your own lobby**");

                        for (let hostId in lobbiesInLeagueChannel) {
                            if (lobbiesInLeagueChannel.hasOwnProperty(hostId)) {
                                let lobby = lobbiesInLeagueChannel[hostId];
                                if (lobby.host !== null && lobby.password !== null) {
                                    User.findAllUsersWithSteamIdsIn(lobby.players).then(players => {
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
                                            let dontPrint = false;

                                            if (!dontPrint && lobby.hasOwnProperty("leaves") && lobby.leaves >= 10) {
                                                lobbies.deleteLobby(message.member.guild.id, leagueChannel, lobby.host);
                                                dontPrint = true;
                                                discordUtil.sendChannel(message.channel.id, "_*** @" + lobby.region + " <@" + hostDiscordId + "> lobby has been removed because too many players left it._");
                                                discordUtil.sendDM(hostDiscordId, "**Your lobby in <#" + message.channel.id + "> was cancelled because too many players left it.**");
                                            }

                                            if (lobby.hasOwnProperty("lastactivity")) {
                                                let lastActivity = Math.round((Date.now() - new Date(lobby.lastactivity)) / 1000 / 60);
                                                if (lastActivity >= 2) {
                                                    lastActivityStr = " (" + lastActivity + "m last activity)";
                                                }
                                                if (!dontPrint && lastActivity > lobbyTimeout1 && !exemptLeagueRolePruning.includes(leagueRole)) {
                                                    lobbies.deleteLobby(message.member.guild.id, leagueChannel, lobby.host);
                                                    dontPrint = true;
                                                    discordUtil.sendChannel(message.channel.id, "_*** @" + lobby.region + " <@" + hostDiscordId + "> lobby has been removed because of no activity (joins/leaves) for more than " + lobbyTimeout1 + " minutes._");
                                                    discordUtil.sendDM(hostDiscordId, "**Your lobby in <#" + message.channel.id + "> was cancelled because of no activity (joins/leaves) for more than 15 minutes.**");
                                                }
                                                if (!dontPrint && lastActivity > 5 && lobby.players.length === 8 && !exemptLeagueRolePruning.includes(leagueRole)) {
                                                    lobbies.deleteLobby(message.member.guild.id, leagueChannel, lobby.host);
                                                    dontPrint = true;
                                                    discordUtil.sendChannel(message.channel.id, "_*** @" + lobby.region + " <@" + hostDiscordId + "> lobby has been removed because it is full and has had no activity (joins/leaves) for more than 5 minutes._");
                                                    discordUtil.sendDM(hostDiscordId, "**Your lobby in <#" + message.channel.id + "> was cancelled because it was full and had no activity (joins/leaves) for more than 5 minutes. Please use `!start` if the game was loaded in the Dota 2 Client next time.**");
                                                }
                                            }
                                            let lobbyTime = Math.round((Date.now() - new Date(lobby.starttime)) / 1000 / 60);

                                            if (!dontPrint && lobbyTime > lobbyTimeout2 && !exemptLeagueRolePruning.includes(leagueRole)) {
                                                lobbies.deleteLobby(message.member.guild.id, leagueChannel, lobby.host);
                                                dontPrint = true;
                                                discordUtil.sendChannel(message.channel.id, "_*** @" + lobby.region + " <@" + hostDiscordId + "> lobby has been removed because it has not started after " + lobbyTimeout2 + " minutes._");
                                                discordUtil.sendDM(hostDiscordId, "**Your lobby in <#" + message.channel.id + "> was cancelled because it was not started after " + lobbyTimeout2 + " minutes. Please use `!start` if the game was loaded in the Dota 2 Client next time.**");
                                            }

                                            let fullStr = "";
                                            let fullStr2 = "";
                                            let host = message.guild.members.get(hostDiscordId).user;
                                            let joinStr = " | Use `!join @" + host.username + "#" + host.discriminator + "` to join lobby.";
                                            if (lobby.players.length >= 8) {
                                                fullStr = "~~";
                                                fullStr2 = "~~";
                                                joinStr = "";

                                                if (Object.keys(lobbiesInLeagueChannel).length >= 5) {
                                                    return 0; // don't print full games when lots of channels
                                                }
                                            }

                                            if (!dontPrint) {
                                                if (printFullList === true) {
                                                    discordUtil.sendChannel(message.channel.id, fullStr + "=== **@" + lobby.region + "** [" + getRankString(lobby.rankRequirement) + "+] `(" + lobby.players.length + "/8)` " + hostDiscord + " | " + playerDiscordIds.join(" | ") + ". (" + lobbyTime + "m)" + lastActivityStr + fullStr2);
                                                } else {
                                                    discordUtil.sendChannel(message.channel.id, fullStr + "=== **@" + lobby.region + "** [" + getRankString(lobby.rankRequirement) + "+] `(" + lobby.players.length + "/8)` " + hostDiscord + joinStr + " (" + lobbyTime + "m)" + lastActivityStr + fullStr2);
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
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "There are no lobbies currently. Use `!host` or `!host " + leagueChannelRegion.toLowerCase() + "` to host one!");
                                return 0;
                            } else {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "There are no lobbies for that region currently. Use `!host [region]` to host one!");
                                return 0;
                            }
                        }
                    })();
                    break;
                case "lobby":
                    (function () {
                        if (disableLobbyCommands === true) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }
                        if (parsedCommand.args.length === 0) {
                            // discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "You need to specify a host.");
                            // return 0;
                            parsedCommand.args[0] = '<@' + message.author.id + '>';
                        }
                        let lobbyHostDiscordId = parseDiscordId(parsedCommand.args[0]);

                        // if (!message.guild.member(lobbyHostDiscordId)) {
                        //     discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Could not find that user on this server.");
                        //     return 0;
                        // }
                        User.findByDiscord(lobbyHostDiscordId).then(hostUser => {
                            let lobby = lobbies.getLobbyForPlayer(message.member.guild.id, leagueChannel, hostUser.steam);

                            if (lobby === null) {
                                discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": That user is not (or you are not) hosting any lobbies.");
                                discordUtil.deleteMessage(message);
                                return 0;
                            }

                            if (lobby.host !== null && lobby.password !== null) {
                                User.findAllUsersWithSteamIdsIn(lobby.players).then(players => {
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
                                        let lobbiesInLeagueChannel = lobbies.getLobbiesInChannel(message.member.guild.id, leagueChannel);
                                        if (Object.keys(lobbiesInLeagueChannel).length < 10) { // don't print if large number of lobbies
                                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "=== **@" + lobby.region + "** [" + getRankString(lobby.rankRequirement) + "+] `(" + lobby.players.length + "/8)` " + hostDiscord + " | " + playerDiscordIds.join(" | ") + ". (" + Math.round((Date.now() - new Date(lobby.starttime)) / 1000 / 60) + "m)" + lastActivityStr);
                                        }
                                        // also whisper
                                        discordUtil.sendDM(message.author.id, "=== **@" + lobby.region + "** [" + getRankString(lobby.rankRequirement) + "+] `(" + lobby.players.length + "/8)`\n" + hostDiscord + "\n" + playerDiscordIds.join("\n") + "\n(Last activity: " + Math.round((Date.now() - new Date(lobby.starttime)) / 1000 / 60) + "m)" + lastActivityStr);
                                        discordUtil.deleteMessage(message);
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
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        let hostLobbyEnd = getLobbyForHost(message.member.guild.id, leagueChannel, user.steam);

                        if (hostLobbyEnd === null) {
                            discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You are not hosting any lobbies in <#" + message.channel.id + ">");
                            discordUtil.deleteMessage(message);
                            return 0;
                        }
                        let regionEnd = hostLobbyEnd["region"];

                        if (lobbies.isHostOfHostedLobby(message.member.guild.id, leagueChannel, user.steam)) {
                            lobbies.deleteLobby(message.member.guild.id, leagueChannel, user.steam);
                            discordUtil.sendChannel(message.channel.id, "<@" + user.discord + "> @" + regionEnd + " region **lobby cancelled**.");
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
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, botDownMessage);
                            return 0;
                        }

                        let playerSendPassLobby = lobbies.getLobbyForPlayer(message.member.guild.id, leagueChannel, user.steam);

                        if (playerSendPassLobby === null) {
                            discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You are not in any lobbies.");
                            discordUtil.deleteMessage(message);
                            return 0;
                        }


                        User.findOneBySteam(playerSendPassLobby.host).then(function (hostUser) {
                            if (hostUser === null) {
                                discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Host not found in database.");
                                discordUtil.deleteMessage(message);
                                return 0;
                            }
                            if (!lobbies.hasHostedLobbyInChannel(leagueChannel, hostUser.steam)) {
                                discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Host not found. Use `!list` to see lobbies or `!host [region]` to start one!");
                                discordUtil.deleteMessage(message);
                                return 0;
                            }

                            let lobby = lobbies.getLobbyForHost(message.member.guild.id, leagueChannel, hostUser.steam);
                            discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": Lobby password for <@" + hostUser.discord + "> " + lobby["region"] + " region: `" + lobby["password"] + "`. Please join this lobby in Dota 2 Custom Games. If you cannot find the lobby, whisper the host on Discord to create it <@" + hostUser.discord + ">.");
                            discordUtil.deleteMessage(message);

                        });
                    })();
                    break;
                default:
                    (function () {
                        // discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Unhandled bot message: " + message.content);
                        // console.log("Unhandled bot message for lobby: " + message.content);
                        isLobbyCommand = false;
                    })();
            }
        }

        let isBotCommand = true;

        switch (parsedCommand.command) {
            case "adminrestartbot":
            case "restartbot":
            case "suicide":
            case "killyourself":
            case "die":
            case "getouttahere":
            case "seppuku":
                (function () {
                    if (!message.member.roles.has(adminRoleId)) return 0;
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
                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, famousLastWords[Math.floor(Math.random() * famousLastWords.length)]);
                    setTimeout(function () {
                        process.exit(1);
                    }, 1000);
                })();
                break;
            case "admindisablebot":
            case "disablebot":
                (function () {
                    if (!message.member.roles.has(adminRoleId)) return 0;

                    if (disableLobbyCommands === false) {
                        disableLobbyCommands = true;

                        lobbies.backupLobbies(logger);
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, lobby commands disabled. Lobby data saved.");
                        return 0;
                    } else {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, I am not enabled!");
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
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, Lobby data loaded. Lobby commands enabled.");
                        return 0;
                    } else {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, I am not disabled.");
                    }
                })();
                break;
            case "admintogglehost":
            case "togglehost":
                (function () {
                    if (!message.member.roles.has(adminRoleId)) return 0;

                    if (disableLobbyHost === true) {
                        disableLobbyHost = false;
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, lobby hosting enabled.");
                    } else {
                        disableLobbyHost = true;
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, lobby hosting disabled.");
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
                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, lobby data saved.");
                })();
                break;
            case "adminlobbyinfo":
            case "lobbyinfo":
                (function () {
                    if (!message.member.roles.has(adminRoleId)) return 0;

                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "disableLobbyCommands: " + disableLobbyCommands + ", " + "disableLobbyHost: " + disableLobbyHost);
                    // add lobby sizes
                })();
                break;
            case "adminclearlobbies":
            case "clearlobbies":
                (function () {
                    if (!message.member.roles.has(adminRoleId)) return 0;

                    if (parsedCommand.args.length !== 1) {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, invalid argument, try: `!adminclearlobbies " + leagueRoles.join(", ") + "`.");
                        return 0;
                    }
                    let role = parsedCommand.args[0];

                    if (!leagueRoles.includes(role)) {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, invalid League, try:" + leagueRoles.join(", "));
                    }

                    lobbies.resetLobbies(message.member.guild.id, role);
                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, I cleared " + role + " lobbies.");

                    lobbies.backupLobbies(logger);
                })();
                break;
            case "addlobby":
                (function () {
                    if (message.author.id !== "204094307689431043") return 0; // no permissions

                    lobbies.resetLobbies(message.member.guild.id, parsedCommand.args[0]);
                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "OK.");
                })();
                break;
            case "removelobby":
                (function () {
                    if (message.author.id !== "204094307689431043") {
                        return 0; // no permissions
                    }

                    lobbies.removeLobbies(message.member.guild.id, parsedCommand.args[0]);
                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "OK.");
                })();
                break;
            case "adminupdateroles":
                (function () {
                    if (!message.member.roles.has(adminRoleId)) return 0;

                    if (message.channel.type === "dm") {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, I can not update roles in direct messages. Please try in a channel on the server.");
                        return 0;
                    }
                    if (parsedCommand.args.length < 1) {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, the command is `!adminlink [@discord] [[steamid]]`");
                        return 0;
                    }
                    let updateRolePlayerDiscordId = parseDiscordId(parsedCommand.args[0]);

                    User.findByDiscord(updateRolePlayerDiscordId).then(function (playerUser) {
                        if (playerUser === null) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, I could not find that user.");
                            return 0;
                        }
                        updateRoles(discordClient, discordUtil, message, playerUser, true, true);
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, trying to update roles for <@" + playerUser.discord + ">.");
                    });
                })();
                break;
            case "adminunlinksteam":
                (function () {
                    if (!message.member.roles.has(adminRoleId)) return 0;

                    if (parsedCommand.args.length !== 1) {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, the command is `!adminunlinksteam [steamid]`");
                        return 0;
                    }
                    if (!parseInt(parsedCommand.args[0])) {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, 'Sir, that is an invalid steam id');
                        return 0;
                    }
                    let unlinkPlayerSteamId = parsedCommand.args[0];
                    VerifiedSteam.findOneBySteam(unlinkPlayerSteamId).then(verifiedSteam => {
                        if (verifiedSteam === null) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, `Sir, steam id \`${unlinkPlayerSteamId}\` is not verified by anyone.`);
                            return 0;
                        }
                        if (verifiedSteam.banned === true) {
                            let banInfo = `Steam \`${unlinkPlayerSteamId}\` was banned by <@${verifiedSteam.bannedBy}> for \`${verifiedSteam.banReason}\``;
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, banInfo + "\n I cannot unlink unless you `unblacklist`");
                        } else {
                            verifiedSteam.destroy().then(
                                () => discordUtil.sendChannelAndMention(message.channel.id, message.author.id, `Sir, I have removed verified steam id record for \`${unlinkPlayerSteamId}\``))
                            User.findAllBySteam(unlinkPlayerSteamId).then(function (unlinkPlayerUsers) {
                                unlinkPlayerUsers.forEach(unlinkPlayerUser => {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, I have unlinked <@" + unlinkPlayerUser.discord + ">'s steam id.");
                                    unlinkPlayerUser.update({steam: null, validated: false});
                                });
                            });
                        }
                    });
                })();
                break;
            case "unblacklist":
                (function () {
                    if (!message.member.roles.has(adminRoleId)) return 0;

                    if (parsedCommand.args.length !== 1) {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, the command is `!unblacklist [steamid]`");
                        return 0;
                    }

                    const steamId = parsedCommand.args[0];
                    if (!parseInt(steamId)) {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, 'Sir, that is an invalid steam id');
                        return 0;
                    }
                    VerifiedSteam.unbanSteam(steamId, message.author.id).then(verifiedSteam => {
                            if (verifiedSteam === null) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, `Sir, \`${steamId}\` is not blacklisted.`);
                            } else if (verifiedSteam.userId !== null) {
                                User.findById(verifiedSteam.userId).then(bannedUser => {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, `I have removed steam id \`${steamId}\` from the blacklist, don't forget to unban the linked user <@${bannedUser.discord}> as well!`);
                                });
                            } else {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, `I have remove steam id \`${steamId}\` from the blacklist`);
                            }
                        }
                    );
                    return 0;
                })();
                break;
            case "admingetsteam":
            case "getsteam":
            case "gets":
                (function () {
                    if (!message.member.roles.has(adminRoleId)) return 0;

                    if (parsedCommand.args.length !== 1) {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, the command is `!admingetsteam [@discord]`");
                        return 0;
                    }
                    let infoPlayerDiscordId = parseDiscordId(parsedCommand.args[0]);

                    if (infoPlayerDiscordId === null) {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, that is an invalid Discord ID. Make sure it is a mention (blue text).");
                        return 0;
                    }

                    User.findUserAndVerifiedSteamsByDiscord(infoPlayerDiscordId).then(function (infoPlayerUser) {
                        if (infoPlayerUser === null) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, I did not find any matches in database for <@" + infoPlayerDiscordId + ">");
                            return 0;
                        }
                        if (infoPlayerUser.steam === null) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, I could not find a steam id for <@" + infoPlayerUser.discord + ">.");
                            return 0;
                        }
                        if (infoPlayerUser.validated === false && infoPlayerUser.verifiedSteams.length === 0) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, `Sir, <@${infoPlayerUser.discord}> is linked to steam id ${infoPlayerUser.steam} (not verified).`);
                            return 0;
                        }

                        let verifiedSteams = infoPlayerUser.verifiedSteams.map(verifiedSteam => {
                            let active = (verifiedSteam.steam === infoPlayerUser.steam) ? "(active)" : "";
                            let banInfo = verifiedSteam.banned === true ? `, banned by <@${verifiedSteam.bannedBy}> for \`${verifiedSteam.banReason}\`` : "";
                            return `\`${verifiedSteam.steam}${active}\` linked at ${verifiedSteam.createdAt.toLocaleString("en-us")}(UTC)${banInfo}`;
                        }).join(',');
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id,
                            `Sir, <@${infoPlayerUser.discord}> is linked to steam id: ${verifiedSteams}.`);
                    });
                })();
                break;
            case "admingetdiscord":
            case "getdiscord":
            case "getd":
                (function () {
                    if (!message.member.roles.has(adminRoleId)) return 0;

                    if (parsedCommand.args.length !== 1) {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, the command is `!admingetdiscord [steam]`");
                        return 0;
                    }
                    const steamId = parsedCommand.args[0];

                    if (!parseInt(steamId)) {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, 'Sir, that is an invalid steam id');
                        return 0;
                    }

                    VerifiedSteam.findOneBySteam(steamId).then(verifiedSteam => {
                        if (verifiedSteam === null) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, I did not find any matching users in database for steamId `" + steamId + "`.");
                        } else {
                            let banInfo = verifiedSteam.banned === true ? `, banned by <@${verifiedSteam.bannedBy}> for \`${verifiedSteam.banReason}\`` : "";
                            User.findById(verifiedSteam.userId).then(user => {
                                if (user === null) {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id,
                                        `Sir, the steam is not linked to any user${banInfo}.`);
                                } else {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id,
                                        `Sir, I found the user linked to \`${steamId}\`: <@${user.discord}>${banInfo}.`);
                                }
                            });
                        }
                    }).catch(logger.error);
                })();
                break;
            case "verificationstats":
            case "vstats":
                (function () {
                    if (!message.member.roles.has(adminRoleId)) return 0;
                    if (message.channel.type !== "dm") {
                        User.getVerificationStats().then(count => {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, `Sir, ${count} users have verified their steam accounts.`);
                            return 0;
                        });
                    }
                })();
                break;
            case "setactivetournament":
                (function () {
                    if (message.author.id !== "204094307689431043") return 0; // no permissions

                    if (parsedCommand.args.length !== 1) {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "!setactivetournament [id]");
                    }

                    activeTournament = parsedCommand.args[0];
                })();
                break;
            case "createtournament":
                (function () {
                    if (message.author.id !== "204094307689431043") return 0; // no permissions

                    Tournament.createTournament({
                        name: "Team Liquid & qihl Auto Chess Masters",
                        description: "- 32 Players, with only the highest ranking players who sign-up getting to compete.\n- 5 Round point-based format.\n- $400 prize pool: $200 for first place, $125 for second place, and $75 for third.",
                        signupstartdatetime: Date.now(),
                        signupenddatetime: Date.now(),
                        tournamentstartdatetime: Date.now(),
                        tournamentenddatetime: Date.now(),
                        tournamentsettings: JSON.stringify({"test": "test"}),
                    }).then(tournament => {
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Created!");
                    })
                })();
                break;
            case "admintournamentlist":
                (function () {
                    if (!message.member.roles.has(adminRoleId)) return 0;
                    let counter = 0;
                    Tournament.findAllTopRegistrations(64).then(registrations => {
                        registrations.forEach(registration => {
                            counter++;
                            let discordUser = message.guild.members.find(r => r.id === registration.discord);
                            if (discordUser !== null) {
                                discordUtil.sendChannel(message.channel.id, "`(" + counter + ") " + "MMR " + registration.score + " " + registration.region + " ` " + registration.country + " ` " + new Date(parseInt(registration.date)).toUTCString() + " | " + discordUser.user.username + "#" + discordUser.user.discriminator + "`");
                            }
                        });
                    });
                })();
                break;
            case "register":
                (function () {
                    if (message.channel.name === "tournament-signups") {
                        if (user.validated !== true) {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "You must have a verified account in order to register for tournaments. See <#" + discordClient.channels.find(c => c.name === config.channels['readme']).id + "> for instructions.");
                            return 0;
                        }

                        Tournament.findRegistration({fk_tournament: activeTournament, steam: user.steam}).then(result => {
                            if (result !== null) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "That steam id has already been registered in this tournament. Information:\nDate: `" + new Date(parseInt(result.date)).toString() + "`\nDiscord: <@" + result.discord + ">\nSteam ID: `" + result.steam + "`\nRank: " + getRankString(result.rank) + "\nMMR: `" + result.score + "`\nPreferred Region: `" + result.region + "`\nCountry: " + result.country);
                                return 0;
                            }

                            if (parsedCommand.args.length < 2) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Invalid arguments. Must be `!register [" + validRegions.join(', ').toLowerCase() + "] [:flag_ca:, :flag_us:, ...]`");
                                return 0;
                            }

                            let region = parsedCommand.args[0].toUpperCase();

                            if (!validRegions.includes(region.toUpperCase())) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Invalid arguments. Must be `!register [" + validRegions.join(', ').toLowerCase() + "] [:flag_ca:, :flag_us:, ...]`");
                                return 0;
                            }

                            let country = parsedCommand.args[1].toUpperCase();
                            if (country.length !== 4) { // emoji utf-8 character for flag
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Invalid arguments. Must be `!register [" + validRegions.join(', ').toLowerCase() + "] [:flag_ca:, :flag_us:, ...]`");
                                return 0;
                            }

                            Tournament.createRegistration({
                                fk_tournament: activeTournament,
                                discord: user.discord,
                                steam: user.steam,
                                rank: user.rank,
                                score: user.score,
                                date: Date.now(),
                                region: region,
                                country: country,
                            }).then(registration => {
                                Tournament.getTournament(registration.fk_tournament).then(tournament => {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Successfully registered you for the " + tournament.name + "! I have recorded your rank " + getRankString(registration.rank) + " and MMR `" + registration.score + "` on `" + new Date(parseInt(registration.date)).toString() + "` with Steam ID: `" + registration.steam + "`. Your preferred region is `" + registration.region + "`. Your country is " + registration.country + ".");
                                });
                            });
                        });
                    }
                })();
                break;
            case "unregister":
                (function () {
                    if (message.channel.name === "tournament-signups") {
                        Tournament.findRegistration({
                            fk_tournament: activeTournament,
                            steam: user.steam
                        }).then(result => {
                            if (result !== null) {
                                result.destroy().then(success => {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "I have unregistered you for the current tournament.");
                                    return 0;
                                })
                            } else {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "You have not registered for the current tournament yet.");
                                return 0;
                            }
                        });
                    }
                })();
                break;
            case "adminunregister":
                (function () {
                    if (message.author.id !== "204094307689431043") return 0; // no permissions

                    let discordUser = parseDiscordId(parsedCommand.args[0]);

                    Tournament.findRegistration({discord: discordUser}).then(registration => {
                        registration.destroy().then(deleted => {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Sir, I deleted that tournament registration by <@" + deleted.discord + ">");
                        });
                    });
                })();
                break;
            case "getrank":
            case "checkrank":
            case "rank":
                (function () {
                    if (leagueLobbies.includes(message.channel.name)) {
                        discordUtil.sendDM(message.author.id, "You can not use `!rank` in lobby channels.");
                        discordUtil.deleteMessage(message);
                        return 0;
                    }
                    if (parsedCommand.args.length === 1) {
                        let getRankUserDiscordId = parseDiscordId(parsedCommand.args[0]);

                        if (getRankUserDiscordId !== null) {
                            if (!message.guild.member(getRankUserDiscordId)) {
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Could not find that user on this server.");
                                return 0;
                            }
                            User.findByDiscord(getRankUserDiscordId).then(getRankUser => {
                                if (getRankUser === null || getRankUser.steam === null) {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "That user has not linked a steam id yet.");
                                    return 0;
                                }
                                dacService.getRankFromSteamId(getRankUser.steam).then(rank => {
                                    if (rank === null) {
                                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "I am having problems verifying your rank.");
                                        return 0;
                                    }

                                    let MMRStr = "";
                                    if (rank.score !== null) {
                                        MMRStr =  " MMR is: `" + rank.score + "`.";
                                    }

                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Current rank for <@" + getRankUser.discord + "> is: " + getRankString(rank.mmr_level) + "." + MMRStr);

                                    if (leagueLobbies.includes(message.channel.name)) {
                                        discordUtil.deleteMessage(message);
                                    }
                                    return 0;
                                });
                            });
                        } else if (parseInt(parsedCommand.args[0])) {
                            let publicSteamId = parsedCommand.args[0];

                            dacService.getRankFromSteamId(publicSteamId).then(rank => {
                                if (rank === null) {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "I am having problems verifying your rank.");
                                    return 0;
                                }

                                let MMRStr = "";
                                if (rank.score !== null) {
                                    MMRStr =  " MMR is: `" + rank.score + "`.";
                                }

                                if (user.steam === publicSteamId) {
                                    //todo remind about people they can just use !rank with no param
                                }

                                // discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Current rank for " + publicSteamId + " is: " + getRankString(rank.mmr_level) + "." + MMRStr);
                                discordUtil.sendDM(message.author.id, "Current rank for " + publicSteamId + " is: " + getRankString(rank.mmr_level) + "." + MMRStr);

                                if (leagueLobbies.includes(message.channel.name)) {
                                    discordUtil.deleteMessage(message);
                                }
                                return 0;
                            });
                        } else {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Invalid arguments.");
                        }
                    } else {
                        if (user !== null && user.steam !== null && user.steamLinkToken === null) {
                            dacService.getRankFromSteamId(user.steam).then(rank => {
                                if (rank === null) {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "I am having problems verifying your rank.");
                                    return 0;
                                }

                                let MMRStr = "";
                                if (rank.score !== null) {
                                    MMRStr =  " MMR is: `" + rank.score + "`. ";
                                }

                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Your current rank is: " + getRankString(rank.mmr_level) + "." + MMRStr);
                                let rankUpdate = {rank: rank.mmr_level, score: rank.score};
                                if (rank.score === null) delete rankUpdate["score"];

                                return 0; // turn off updating roles with rank for now
                                user.update(rankUpdate).then(nothing => {
                                    if (leagueLobbies.includes(message.channel.name)) {
                                        updateRoles(discordClient, discordUtil, message, nothing, false, false, true);
                                    } else {
                                        updateRoles(discordClient, discordUtil, message, nothing, false, false, false);
                                    }
                                });
                            });
                        } else {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, `You have not linked a steam id. Follow instructions in <#${discordClient.channels.find(c => c.name === config.channels['readme']).id}> to verify.`);
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
                                discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Could not find that user on this server.");
                                return 0;
                            }
                            User.findByDiscord(getSteamPersonaUserDiscordId).then(getSteamPersonaUser => {
                                getSteamPersonaNames([getSteamPersonaUser.steam]).then(personas => {
                                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "<@" + getSteamPersonaUser.discord + "> Steam Name is \"" + personas[getSteamPersonaUser.steam] + "\"");
                                });
                            });
                        } else {
                            discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "Invalid arguments.");
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
                        discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "I can not update roles in direct messages. Please try in <#" + discordClient.channels.find(c => c.name === config.channels["chessbot-commands"]).id + ">.");
                        return 0;
                    }
                    if (leagueLobbies.includes(message.channel.name)) {
                        updateRoles(discordClient, discordUtil, message, user, true, true, true);
                    } else {
                        updateRoles(discordClient, discordUtil, message, user, true, true, false);
                    }
                })();
                break;
            case "help":
                (function () {
                    discordUtil.sendChannelAndMention(message.channel.id, message.author.id, "See <#" + discordClient.channels.find(c => c.name === config.channels["chessbot-help"]).id + "> for more information.");
                })();
                break;
            case "staffhelp":
            case "shelp":
            case "sh":
                (function () {
                    if (parsedCommand.args.length === 0) {
                        discordUtil.sendDM(message.author.id, "Sir, the command is !staffhelp [@discord] [topic] [[language]].");
                        discordUtil.deleteMessage(message);
                        return 0;
                    }
                    let staffHelpUserDiscordId = parseDiscordId(parsedCommand.args[0]);
                    if (staffHelpUserDiscordId === null) {
                        discordUtil.sendDM(message.author.id, "Sir, that is an invalid Discord ID.  Make sure it is a mention (blue text).");
                        discordUtil.deleteMessage(message);
                        return 0;
                    }

                    if (staffHelpUserDiscordId !== null) {
                        if (!message.guild.member(staffHelpUserDiscordId)) {
                            discordUtil.sendDM(message.author.id, "Sir, I could not find that user on this server.");
                            discordUtil.deleteMessage(message);
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
                            discordUtil.sendDM(message.author.id, "Could not find that help topic.");
                            discordUtil.deleteMessage(message);
                            return 0;
                    }

                    discordUtil.sendChannelAndMention(message.channel.id, staffHelpUserDiscordId, helptext);
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
                discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": You can not use lobby commands in this channel.");
                discordUtil.deleteMessage(message);
                return 0;
            }
            if (isLobbyCommand === false) {
                logger.info("Unhandled bot message: " + message.content);
                discordUtil.sendDM(message.author.id, "<#" + message.channel.id + "> \"" + message.content + "\": I was not able to process this command. Please read <#" + discordClient.channels.find(c => c.name === config.channels["chessbot-help"]).id + "> for command list. Join <#" + discordClient.channels.find(c => c.name === config.channels["help-desk"]).id + "> for help from staff.");
                discordUtil.deleteMessage(message);
                return 0;
            }
        }
    });
}

for(let i = 0; i < config.discord_tokens.length; i++) {
    discordClients[i].login(config.discord_tokens[i]);
}
