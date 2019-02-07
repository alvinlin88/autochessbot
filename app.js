const Discord = require('discord.js'),
    discordClient = new Discord.Client();

const randtoken = require("rand-token");
const fs = require("fs");

global.config = require("./config");

const request = require('request');

const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const sequelize = new Sequelize('autochess', 'postgres', 'postgres', {
    host: 'localhost',
    dialect: 'sqlite',

    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },

    // http://docs.sequelizejs.com/manual/tutorial/querying.html#operators
    operatorsAliases: false,

    // SQLite only
    storage: global.config.sqlitedb
});

const User = sequelize.define('user', {
    discord: {
        type: Sequelize.TEXT,
        unique: true,
        allowNull: false,
    },
    steam: {
        type: Sequelize.TEXT,
        // unique: true, // might be bad idea to enforce this (others might steal steam_id without verification)
        allowNull: true,
    },
    rank: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    // unused, future proofing database
    score: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    games_played: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    steamLinkToken: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    validated: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
    }
});

User.sync();


PREFIX = "!cb ";

discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}!`);
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

function reply(message, text, priv=false, mention=true) {
    if (priv === true) {
        message.author.send(text);
        console.log('Sent private message to ' + message.author.username + ': ' + text);
    } else {
        if (mention) {
            message.channel.send('<@' + message.author.id + '> ' + text);
            console.log('Sent message in channel ' + message.channel.name + ' to ' + message.author.username + ': ' + text);
        } else {
            message.channel.send(text);
            console.log('Sent message in channel ' + message.channel.name + ': ' + text);
        }
    }
}

function getRankString(rank) {
    if (rank > 0 && rank <= 9) { return "Pawn-" + (rank).toString();}
    if (rank >= 10 && rank < (10 + 9)) { return "Knight-" + (rank - 9).toString(); }
    if (rank >= (10 + 9) && rank < (10 + 9 + 9)) { return "Bishop-" + (rank - 9 - 9).toString(); }
    if (rank >= (10 + 9 + 9) && rank < (10 + 9 + 9 + 9)) { return "Rook-" + (rank - 9 - 9 - 9).toString(); }
    if (rank >= (10 + 9 + 9 + 9)) { return "King-" + (rank - 9 - 9 - 9 - 9).toString(); }
    return "Error";
}

function parseRank(rankInput) {
    let stripped = rankInput.toLowerCase().replace(/\W+/g, '');
    let rankStr = stripped.replace(/[0-9]/g, '');
    let rankNum = stripped.replace(/[a-z]/g, '');

    let mappings = {"pawn": 0, "knight": 1, "bishop": 2, "rook": 3, "king": 4};

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

function getRankFromSteamId(steamId) {
    return new Promise(function(resolve, reject) {
        request('http://101.200.189.65:431/dac/heros/get/@' + steamId, { json: true}, (err, res, body) => {
            if (err) { reject(err); }

            if (res.hasOwnProperty("statusCode")) {
                if (res.statusCode === 200) {
                    try {
                        console.log("Got result from server: " + JSON.stringify(body.user_info));
                        resolve({
                            "mmr_level": body.user_info[steamId.toString()].mmr_level,
                            "score": body.user_info[steamId.toString()].score
                        });
                    } catch (error) {
                        console.log(error);
                    }
                }
            }
        });
    });
}

function getRanksFromSteamIdList(steamIdList) {
    return new Promise(function(resolve, reject) {
        request('http://101.200.189.65:431/dac/ranking/get?player_ids=' + steamIdList.join(','), { json: true}, (err, res, body) => {
            if (err) { reject(err); }

            if (res.hasOwnProperty("statusCode")) {
                if (res.statusCode === 200) {
                    try {
                        console.log("Got result from server: " + JSON.stringify(body.ranking_info));
                        resolve(body.ranking_info);
                    } catch (error) {
                        console.log(error);
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


let adminRoleName = global.config.adminRoleName;
let leagueRoles = global.config.leagueRoles;
let leagueToLobbies = global.config.leagueToLobbies;
let lobbiesToLeague = global.config.lobbiesToLeague;
let leagueRequirements = global.config.leagueRequirements;
let leagueChannels = global.config.leagueChannels;
let validRegions = global.config.validRegions;
let regionTags = global.config.regionTags;
let lobbies = {}; // we keep lobbies in memory
let listratelimit = {};
let disableLobbyCommands = true;
let disableLobbyHost = false;

leagueRoles.forEach(leagueRole => {
    lobbies[leagueRole] = {};
    // validRegions.forEach(region => {
    //     lobbies[leagueRole][region] = {
    //         "host": null,
    //         "players": [],
    //         "password": null,
    //     }
    // });
});

function getLobbyHosts(leagueRole) {
    let hosts = [];

    for (let region in lobbies[leagueRole]) {
        if (lobbies[leagueRole].hasOwnProperty(region)) {
            let lobby = lobbies[leagueRole][region];

            hosts.push(lobby["host"]);
        }
    }

    return hosts;
}

function getLobbyForHost(leagueRole, host) {
    let result = null;
    for (let hostId in lobbies[leagueRole]) {
        if (lobbies[leagueRole].hasOwnProperty(hostId)) {
            let lobby = lobbies[leagueRole][hostId];

            if (lobby["host"] === host) {
                result = lobby;
            }
        }
    }
    return result;
}

function getLobbyForPlayer(leagueRole, player) {
    let result = null;
    for (let hostId in lobbies[leagueRole]) {
        if (lobbies[leagueRole].hasOwnProperty(hostId)) {
            let lobby = lobbies[leagueRole][hostId];

            lobby["players"].forEach(p => {
                if (p === player) {
                    result = lobby;
                }
            });
        }
    }
    return result;
}

function getSteamPersonaNames(steamIds) {
    return new Promise(function(resolve, reject) {
        request("http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=" + config.steam_token + "&steamids=" + steamIds.join(","), { json: true}, (err, res, body) => {
            if (err) { reject(err); }

            if (res.hasOwnProperty("statusCode")) {
                if (res.statusCode === 200) {
                    try {
                        console.log("Got result from server: " + JSON.stringify(body.response));

                        let personaNames = {};

                        for (let playerKey in body.response.players) {
                            if (body.response.players.hasOwnProperty(playerKey)) {
                                let player = body.response.players[playerKey];

                                personaNames[player["steamid"]] = player["personaname"];
                            }
                        }

                        resolve(personaNames);
                    } catch (error) {
                        console.log(error);
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

            if (res.hasOwnProperty("statusCode")) {
                if (res.statusCode === 200) {
                    try {
                        console.log("Got result from server: " + JSON.stringify(body.response));

                        let personaNames = {};

                        for (let playerKey in body.response.players) {
                            if (body.response.players.hasOwnProperty(playerKey)) {
                                let player = body.response.players[playerKey];

                                personaNames[player["steamid"]] = player;
                            }
                        }

                        resolve(personaNames);
                    } catch (error) {
                        console.log(error);
                    }
                }
            }
        });
    });
}


discordClient.on('message', message => {
    if (message.author.bot === true) {
        return 0; // ignore bot messages
    }
    // private message
    if (message.channel.type === "dm") {
        // nothing
    }
    if (message.content.substring(0, PREFIX.length) === PREFIX || message.content.substring(0, 1) === "!") {
        console.log(" *** Received command: " + message.content);

        const parsedCommand = parseCommand(message);
        const userPromise = User.findOne({where: {discord: message.author.id}});

        let leagueLobbies = [];
        leagueRoles.forEach(leagueRole => {
            leagueLobbies.push(leagueToLobbies[leagueRole]);
        });

        if (leagueLobbies.includes(message.channel.name)) {
            let leagueRole = lobbiesToLeague[message.channel.name];
            userPromise.then(user => {
                if (user === null || user.steam === null) {
                    reply(message, "You need to link a steam id to use bot commands in lobbies. See <#542454956825903104> for more information.");
                    return 0;
                }
                switch (parsedCommand.command) {
                    case "admincancel":
                    case "adminend":
                        let botAdminRoleEnd = message.guild.roles.find(r => r.name === adminRoleName);
                        if (message.member.roles.has(botAdminRoleEnd.id)) {

                            if (parsedCommand.args.length !== 1) {
                                reply(message, "Sir, the command is `!cb admincancel [@host]`");
                            }

                            let hostLobbyDiscordId = parseDiscordId(parsedCommand.args[0]);
                            User.find({where: {discord: hostLobbyDiscordId}}).then(hostUser => {
                                let hostLobbyEnd = getLobbyForHost(leagueRole, hostUser.steam);
                                let regionEnd = hostLobbyEnd["region"];

                                delete lobbies[leagueRole][hostUser.steam];
                                reply(message, "Lobby for " + regionEnd + " region cancelled.");
                            });
                        } else {
                            // no permissions
                        }
                        break;
                    case "adminkick":
                        let botAdminRoleKick = message.guild.roles.find(r => r.name === adminRoleName);
                        if (!message.member.roles.has(botAdminRoleKick.id)) {
                            // no permissions
                            return 0;
                        }

                        if (parsedCommand.args.length !== 2) {
                            reply(message, "Sir, the command is `!cb adminkick [@host] [@player]`.");
                            return 0;
                        }
                        let hostDiscordIdKick = parseDiscordId(parsedCommand.args[0]);
                        let playerDiscordIdKick = parseDiscordId(parsedCommand.args[1]);

                        if (hostDiscordIdKick === null) {
                            reply(message, "Invalid Host Discord ID.");
                        }
                        if (playerDiscordIdKick === null) {
                            reply(message, "Invalid Player Discord ID.");
                        }

                        User.findOne({where: {discord: hostDiscordIdKick}}).then(hostUser => {
                            User.findOne({where: {discord: playerDiscordIdKick}}).then(playerUser => {
                                let hostLobby = getLobbyForHost(leagueRole, hostUser.steam);
                                if (hostLobby === null) {
                                    reply(message, "Sir, that person isn't hosting a lobby currently.");
                                    return 0;
                                }
                                if (hostUser.steam === playerUser.steam) {
                                    reply(message, "Sir, you can not kick the host from their own lobby. Use `!cb admincancel [@host]` instead.");
                                    return 0;
                                }

                                let index = lobbies[leagueRole][hostUser.steam].players.indexOf(playerUser.steam);

                                if (index > -1) {
                                    lobbies[leagueRole][hostUser.steam].players.splice(index, 1);
                                    let kickUserName = message.client.users.find("id", playerUser.discord);
                                    reply(message, "kicked " + kickUserName + " from " + hostLobby.region + " region lobby. `(" + lobbies[leagueRole][hostUser.steam].players.length + "/8)`");
                                }
                            });
                        });
                        break;
                    case "host": // done
                        if (disableLobbyCommands === true) {
                            reply(message, "Bot is down for maintenance. Lobby commands are currently disabled. Be back soon!");
                            return 0;
                        }
                        if (disableLobbyHost === true) {
                            reply(message, "Lobby hosting disabled. Bot is going down for maintenance.");
                        }

                        let hostLobbyExist = getLobbyForHost(leagueRole, user.steam);

                        if (hostLobbyExist !== null) {
                            reply(message, "You are already hosting a lobby.");
                            return 0;
                        }

                        if (parsedCommand.args.length < 1) {
                            reply(message, "Invalid arguments. Try `!cb host [" + validRegions.join(', ').toLowerCase() + "] [[Rank-1]]`");
                            return 0;
                        }

                        let region = parsedCommand.args[0].toUpperCase();

                        let rankRequirement = leagueRequirements[leagueRole];

                        if (parsedCommand.args.length === 1) {
                            rankRequirement = leagueRequirements[leagueRole];
                        } else if (parsedCommand.args.length === 2) {
                            rankRequirement = parseRank(parsedCommand.args[1]);

                            if (rankRequirement === null) {
                                reply(message, "Invalid rank requirement. Example: Bishop-1");
                                return 0;
                            }
                        } else if (parsedCommand.args.length > 2) {
                            reply(message, "Invalid arguments. Must be [" + validRegions.join(', ') + "] [Rank-1]");
                            return 0;
                        }

                        if (!validRegions.includes(region)) {
                            reply(message, "Invalid arguments. Must be [" + validRegions.join(', ') + "] [Rank-1]");
                            return 0;
                        }

                        // create lobby
                        getRankFromSteamId(user.steam).then(rank => {
                            user.update({rank: rank.mmr_level, score: rank.score});
                            if (rank.mmr_level < leagueRequirements[leagueRole]) {
                                reply(message, "You are not high enough rank to host this lobby. (Your rank: `" + getRankString(rank.mmr_level) + "`, required rank: `" + getRankString(leagueRequirements[leagueRole]) + "`)");
                                return 0;
                            }
                            if (rank.mmr_level < rankRequirement) {
                                reply(message, "You are not high enough rank to host this lobby. (Your rank: `" + getRankString(rank.mmr_level) + "`, required rank: `" + getRankString(rankRequirement) + "`)");
                                return 0;
                            }
                            // good to start
                            let token = randtoken.generate(5);

                            lobbies[leagueRole][user.steam] = {
                                "host": user.steam,
                                "password": region.toLowerCase() + "_" + token.toLowerCase(),
                                "players": [user.steam],
                                "region": region,
                                "rankRequirement": rankRequirement,
                            };

                            let currentLobby = getLobbyForPlayer(leagueRole, user.steam);

                            reply(message, leagueChannels[leagueRole] + " " + regionTags[region] + " Lobby started by <@" + user.discord + "> `" + getRankString(rank.mmr_level) + "`. Type \"!cb join <@" + user.discord + ">\" to join! **[**`" + getRankString(lobbies[leagueRole][user.steam]["rankRequirement"]) + "` **required to join]** The bot will whisper you the password on Discord. Please do not post it here.`(" + currentLobby.players.length + "/8)`", false, false);
                            reply(message, leagueChannels[leagueRole] + " Please host a private Dota Auto Chess lobby in " + region + " region with the following password: `" + lobbies[leagueRole][user.steam]["password"] + "`. Please remember to double check people's ranks and make sure the right ones joined the game before starting. Wait until the game has started in the Dota 2 client before typing `!cb start`.", true);
                        });
                        break;
                    case "start": // done
                        if (disableLobbyCommands === true) {
                            reply(message, "Bot is down for maintenance. Lobby commands are currently disabled. Be back soon!");
                            return 0;
                        }

                        // check 8/8 then check all ranks, then send passwords
                        let hostLobbyStart = lobbies[leagueRole][user.steam];

                        if (hostLobbyStart === undefined || hostLobbyStart === null) {
                            reply(message, "You are not hosting any lobbies.");
                            return 0;
                        }

                        let lobby = lobbies[leagueRole][user.steam];

                        if (parsedCommand.args.length > 0) { // TODO: DRY
                            let force = parsedCommand.args[0];

                            if (force !== "force") {
                                reply(message, "Invalid arguments");
                                return 0;
                            }
                            if (lobby.players.length < 2) {
                                reply(message, "You need at least 2 players to force start a lobby. `(" + hostLobbyStart.players.length + "/8)`");
                                return 0;
                            }

                            let wheres = [];
                            lobbies[leagueRole][user.steam].players.forEach(steamId => {
                                wheres.push({steam: steamId});
                            });
                            User.findAll({where: {[Op.or]: wheres}}).then(players => {
                                getSteamPersonaNames(lobby.players).then(personas => {
                                    let playerDiscordIds = [];

                                    players.forEach(player => {
                                        if (player.steam !== lobby.host) {
                                            playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam] + "\" `" + getRankString(player.rank) + "`");
                                        } else {
                                            playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam] + "\" `" + getRankString(player.rank) + "` **[Host]**");
                                        }
                                    });

                                    delete lobbies[leagueRole][user.steam];

                                    reply(message, leagueChannels[leagueRole] + " " + hostLobbyStart.region + " region lobby started. Good luck! " + playerDiscordIds.join(" | "));
                                });
                            });
                        } else {
                            if (lobby.players.length === 8) {
                                let wheres = [];
                                lobbies[leagueRole][user.steam].players.forEach(steamId => {
                                    wheres.push({steam: steamId});
                                });
                                User.findAll({where: {[Op.or]: wheres}}).then(players => {
                                    getSteamPersonaNames(lobby.players).then(personas => {
                                        let playerDiscordIds = [];

                                        players.forEach(player => {
                                            if (player.steam !== lobby.host) {
                                                playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam] + "\" `" + getRankString(player.rank) + "`");
                                            } else {
                                                playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam] + "\" `" + getRankString(player.rank) + "` **[Host]**");
                                            }
                                        });

                                        reply(message, leagueChannels[leagueRole] + " " + lobbies[leagueRole][user.steam]["region"] + " region lobby started. Good luck! " + playerDiscordIds.join(" | "));
                                        delete lobbies[leagueRole][user.steam];
                                    });
                                });
                            } else {
                                reply(message, "Not enough players to start yet. `(" + hostLobbyStart.players.length + "/8)`");
                            }
                        }
                        break;
                    case "join": // done
                        if (disableLobbyCommands === true) {
                            reply(message, "Bot is down for maintenance. Lobby commands are currently disabled. Be back soon!");
                            return 0;
                        }

                        let playerLobbyJoin = getLobbyForPlayer(leagueRole, user.steam);

                        if (playerLobbyJoin !== null) {
                            reply(message, "You are already in a lobby! Use `!cb leave` to leave.");
                            return 0;
                        }
                        if (parsedCommand.args.length === 0) {
                            reply(message, "Need to specify a host or region to join.", true); // TODO: Change to available lobbies.
                            message.delete("Processed").catch(console.error);
                            return 0;
                        }

                        getRankFromSteamId(user.steam).then(rank => {
                            let resultLobbyHostId = null;

                            if (validRegions.includes(parsedCommand.args[0].toUpperCase())) {
                                let region = parsedCommand.args[0].toUpperCase();
                                // find host with most users not over 8 and join.

                                if (lobbies[leagueRole].length === 0) {
                                    reply(message, "There are no lobbies for that region currently. Use !cb host [" + region + "] to host one!");
                                }
                                for (let currentHostId in lobbies[leagueRole]) {
                                    if (lobbies[leagueRole].hasOwnProperty(currentHostId)) {
                                        if (lobbies[leagueRole][currentHostId].players.length < 8) {
                                            if (rank.mmr_level >= lobbies[leagueRole][currentHostId]["rankRequirement"] && lobbies[leagueRole][currentHostId]["region"] === region) {
                                                if (resultLobbyHostId === null) {
                                                    resultLobbyHostId = lobbies[leagueRole][currentHostId].host;
                                                } else {
                                                    if (lobbies[leagueRole][currentHostId].players.length > lobbies[leagueRole][resultLobbyHostId].players.length) {
                                                        resultLobbyHostId = lobbies[leagueRole][currentHostId].host;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                if (resultLobbyHostId === null) {
                                    reply(message, "Host does not exist or you can not join it. Make sure you have the required rank or a lobby for that region exists. Use `!cb join [@host]` or `!cb join [region]`.", true);
                                    message.delete("Processed").catch(console.error);

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
                                    reply(message, "Host not found in database.");
                                    return 0;
                                }
                                if (!lobbies[leagueRole].hasOwnProperty(hostUser.steam)) {
                                    reply(message, "Host not found. Use `!cb list` to see lobbies or `!cb host [region]` to start one!");
                                    return 0;
                                }
                                if (lobbies[leagueRole][hostUser.steam].players.length === 8) {
                                    reply(message, "Lobby is full.");
                                    return 0;
                                }

                                user.update({rank: rank.mmr_level, score: rank.score});
                                if (rank.mmr_level < leagueRequirements[leagueRole]) {
                                    reply(message, "You are not high enough rank to join lobbies in this league. (Your rank: `" + getRankString(rank.mmr_level) + "`, required league rank: `" + getRankString(leagueRequirements[leagueRole]) + "`)");
                                    return 0;
                                }
                                if (rank.mmr_level < lobbies[leagueRole][hostUser.steam]["rankRequirement"]) {
                                    reply(message, "You are not high enough rank to join this lobby. (Your rank: `" + getRankString(rank.mmr_level) + "`, required lobby rank: `" + getRankString(lobbies[leagueRole][hostUser.steam]["rankRequirement"]) + "`)");
                                    return 0;
                                }

                                lobbies[leagueRole][hostUser.steam].players.push(user.steam);

                                getSteamPersonaNames([user.steam]).then(personaNames => {
                                    reply(message, "<@" + message.author.id + "> \"" + personaNames[user.steam] + "\" `" + getRankString(rank.mmr_level) + "` joined <@" + hostUser.discord + "> " + lobbies[leagueRole][hostUser.steam]["region"] + " region lobby. <@" + message.author.id + "> I just whispered you the lobby password.`(" + lobbies[leagueRole][hostUser.steam].players.length + "/8)`", false, false);
                                    reply(message, leagueChannels[leagueRole] + " Lobby password for <@" + hostUser.discord + ">" + lobbies[leagueRole][hostUser.steam]["region"] + " region: `" + lobbies[leagueRole][hostUser.steam]["password"] + "`", true);
                                    if (lobbies[leagueRole][hostUser.steam].players.length === 8) {
                                        reply(message, "@" + lobbies[leagueRole][hostUser.steam]["region"] + " Lobby is full! <@" + hostUser.discord + "> can start the game with `!cb start`. (Only start the game if you have verified everyone in the game lobby)", false, false);
                                    }
                                });
                            });
                        });
                        break;
                    case "leave":
                    case "quit":
                        if (disableLobbyCommands === true) {
                            reply(message, "Bot is down for maintenance. Lobby commands are currently disabled. Be back soon!");
                            return 0;
                        }

                        let playerLobbyLeave = getLobbyForPlayer(leagueRole, user.steam);

                        if (playerLobbyLeave === null) {
                            reply(message, "You are not in any lobbies.");
                            return 0;
                        }
                        if (playerLobbyLeave.host === user.steam) {
                            reply(message, "Hosts should use `!cb cancel` instead of `!cb leave`");
                            return 0;
                        }

                        let hostDiscordQuitId = playerLobbyLeave["host"];
                        User.findOne({where: {steam: hostDiscordQuitId}}).then(function (hostUser) {
                            let index = lobbies[leagueRole][hostUser.steam].players.indexOf(user.steam);
                            if (index > -1) {
                                lobbies[leagueRole][hostUser.steam].players.splice(index, 1);
                                getSteamPersonaNames([user.steam]).then(personaNames => {
                                    reply(message, "<@" + message.author.id + "> \"" + personaNames[user.steam] + "\" left <@" + hostUser.discord + ">" + playerLobbyLeave.region + " region lobby. `(" + lobbies[leagueRole][hostUser.steam].players.length + "/8)`", false, false);
                                    message.delete("Processed").catch(console.error);
                                });
                            }
                        });
                        break;
                    case "kick":
                        if (disableLobbyCommands === true) {
                            reply(message, "Bot is down for maintenance. Lobby commands are currently disabled. Be back soon!");
                            return 0;
                        }

                        let hostLobby = getLobbyForHost(leagueRole, user.steam);

                        if (hostLobby === null) {
                            reply(message, "You are not hosting any lobbies.");
                            return 0;
                        }
                        if (parsedCommand.args.length < 1) {
                            reply(message, "You need to specify a player to kick: `!cb kick @quest`");
                            return 0;
                        }
                        let kickedPlayerDiscordId = parseDiscordId(parsedCommand.args[0]);

                        if (!message.guild.member(kickedPlayerDiscordId)) {
                            reply(message, "Could not find that user on this server.");
                            return 0;
                        }
                        User.findOne({where: {discord: kickedPlayerDiscordId}}).then(function (kickedPlayerUser) {
                            if (kickedPlayerUser === null) {
                                reply(message, "User not in database. Make sure to use mentions in command: `!cb kick @username`");
                                return 0;
                            }
                            if (hostLobby.players.length === 1) {
                                reply(message, "You can not kick the last player.");
                                return 0;
                            }
                            if (hostLobby.host === kickedPlayerUser.steam) {
                                reply(message, "You can not kick yourself.");
                                return 0;
                            }
                            if (!hostLobby.players.includes(kickedPlayerUser.steam)) {
                                reply(message, "User not in lobby.");
                                return 0;
                            }

                            let index = lobbies[leagueRole][hostLobby.host].players.indexOf(kickedPlayerUser.steam);

                            if (index > -1) {
                                lobbies[leagueRole][hostLobby.host].players.splice(index, 1);
                                let kickUserName = message.client.users.find("id", kickedPlayerDiscordId);
                                reply(message, "kicked " + kickUserName + " from " + hostLobby.region + " region lobby. `(" + lobbies[leagueRole][hostLobby.host].players.length + "/8)`");
                            }
                        }, function (error) {
                            reply(message, "DB Error");
                            console.log(error);
                        });
                        break;
                    case "list":
                    case "lobbies":
                    case "games":
                        if (disableLobbyCommands === true) {
                            reply(message, "Bot is down for maintenance. Lobby commands are currently disabled. Be back soon!");
                            return 0;
                        }

                        // Get player info and print out current users in lobby.
                        let numPrinted = 0;

                        if (listratelimit.hasOwnProperty(leagueRole)) {
                            if (Date.now() - listratelimit[leagueRole] < 5000) {
                                // rate limited
                                return 0;
                            }
                        }

                        listratelimit[leagueRole] = Date.now();

                        for (let hostId in lobbies[leagueRole]) {
                            if (lobbies[leagueRole].hasOwnProperty(hostId)) {
                                let lobby = lobbies[leagueRole][hostId];
                                if (lobby.host !== null && lobby.password !== null) {
                                    let wheres = [];

                                    lobby.players.forEach(steamId => {
                                        wheres.push({steam: steamId});
                                    });
                                    User.findAll({where: {[Op.or]: wheres}}).then(players => {
                                        getSteamPersonaNames(lobby.players).then(personas => {
                                            let playerDiscordIds = [];
                                            let hostDiscord = "Error";
                                            players.forEach(player => {
                                                if (player.steam !== lobby.host) {
                                                    playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam] + "\" `" + getRankString(player.rank) + "`");
                                                } else {
                                                    hostDiscord = "<@" + player.discord + "> \"" + personas[player.steam] + "\" `" + getRankString(player.rank) + "` **[Host]**";
                                                }
                                            });

                                            reply(message, "@" + lobby.region + " [`" + getRankString(lobby.rankRequirement) + "+`] `(" + lobby.players.length + "/8)` " + hostDiscord + " | " + playerDiscordIds.join(" | ") + ".", false, false);
                                        });
                                    });

                                    numPrinted++;
                                }
                            }
                        }
                        if (numPrinted === 0) {
                            reply(message, "There are no lobbies currently being hosted. Use `!cb host [region]` to host one!");
                        }
                        break;
                    case "cancel":
                    case "end":
                        if (disableLobbyCommands === true) {
                            reply(message, "Bot is down for maintenance. Lobby commands are currently disabled. Be back soon!");
                            return 0;
                        }

                        let hostLobbyEnd = getLobbyForHost(leagueRole, user.steam);

                        if (hostLobbyEnd === null) {
                            reply(message, "You are not hosting any lobbies. Use `!cb host [region]` to host one!");
                            return 0;
                        }
                        let regionEnd = hostLobbyEnd["region"];

                        if (user.steam === lobbies[leagueRole][user.steam]["host"]) {
                            delete lobbies[leagueRole][user.steam];
                            reply(message, "Lobby for " + regionEnd + " region cancelled.");
                            return 0;
                        }
                        break;
                    default:
                        // reply(message, "Unhandled bot message: " + message.content);
                        console.log("Unhandled bot message for lobby: " + message.content);
                }
            });
        }

        userPromise.then(user => {
            switch (parsedCommand.command) {
                case "unlink":
                    if (user !== null && user.steam !== null) {
                        user.update({steam: null, steamLinkToken: null, validated: null});
                        // steamFriends.removeFriend(user.steam);
                        console.log("Removed steam friends " + user.steam);

                        reply(message, "You have successfully unlinked your account.");
                    } else {
                        reply(message, "You have not linked a steam id. See <#542454956825903104> for more information.");
                    }
                    break;
                case "link":
                    // this version does not do linking and assumes validated by default
                    const steamIdLink = parsedCommand.args[0];

                    if (!parseInt(steamIdLink)) {
                        reply(message, 'Invalid steam id');
                        return 0;
                    }

                    if (steamIdLink.length < 12 || steamIdLink.includes("[")) {
                        reply(message, "**WARNING** That looks like an invalid steam id. Make sure you are using the \"Steam64 ID\".");
                    }

                    // const token = randtoken.generate(6);

                    User.findAll({where: {steam: steamIdLink}}).then(existingUsers => {
                        let playerDiscordIds = [];

                        // TODO: recheck ranks here
                        existingUsers.forEach(player => {
                            playerDiscordIds.push("<@" + player.discord + ">");
                        });

                        if (existingUsers.length > 1) {
                            reply(message, "**WARNING!** Could not link that steam id. The steam id `" + steamIdLink + "` has been linked to multiple accounts: " + playerDiscordIds.join(", ") + ". See <#542494966220587038> for help.");
                        } else {
                            if (user === null) {
                                User.create({
                                    discord: message.author.id,
                                    steam: steamIdLink,
                                    validated: true,
                                }).then(test => {
                                    console.log(test.toJSON());
                                    reply(message, "I have linked your steam id `" + steamIdLink + "`. If I do not promote you right away then you probably used the wrong steam id or you are set to Invisible on Discord.");
                                    updateRoles(message, test, true, false, true);
                                }).catch(Sequelize.ValidationError, function (msg) {
                                    console.log("error " + msg);
                                });
                            } else {
                                user.update({steam: steamIdLink, validated: true}).then(test => {
                                    reply(message, "I have linked your steam id `" + steamIdLink + "`. If I do not promote you right away then you probably used the wrong steam id or you are set to Invisible on Discord.");
                                    updateRoles(message, test, true, false, true);
                                });
                            }
                        }
                    });

                    // }
                    break;
                case "admintogglebot":
                    let botAdminRoleDisableLobbyCommands = message.guild.roles.find(r => r.name === adminRoleName);
                    if (!message.member.roles.has(botAdminRoleDisableLobbyCommands.id)) {
                        return 0; // no permissions
                    }
                    if (disableLobbyCommands === true) {
                        disableLobbyCommands = false;

                        let lobbiesData = fs.readFileSync(config.lobbies_file, 'utf8');
                        lobbies = JSON.parse(lobbiesData);
                        reply(message, "Lobby data loaded. Lobby commands enabled.");
                        reply(message, "```\n" + lobbiesData + "\n```");
                    } else {
                        disableLobbyCommands = true;

                        fs.writeFileSync(config.lobbies_file, JSON.stringify(lobbies), (err) => {
                            if (err) {console.error(err)}
                        });
                        reply(message, "Lobby commands disabled. Lobby data saved.");
                        reply(message, "```\n" + JSON.stringify(lobbies) + "\n```");
                    }
                    break;
                case "admintogglehost":
                    let botAdminRoleDisableHost = message.guild.roles.find(r => r.name === adminRoleName);
                    if (!message.member.roles.has(botAdminRoleDisableHost.id)) {
                        return 0; // no permissions
                    }
                    if (disableLobbyHost === true) {
                        disableLobbyHost = false;
                        reply(message, "Lobby hosting enabled.");
                    } else {
                        disableLobbyHost = true;
                        reply(message, "Lobby hosting disabled.");
                    }
                    break;
                case "adminclearlobbies":
                    lobbies = {};

                    leagueRoles.forEach(leagueRole => {
                        lobbies[leagueRole] = {};
                    });
                    fs.writeFileSync(config.lobbies_file, JSON.stringify(lobbies), (err) => {
                        if (err) {console.error(err)}
                    });

                    reply(message, "All lobbies cleared.");
                    break;
                case "adminlink":
                    let botAdminRoleLink = message.guild.roles.find(r => r.name === adminRoleName);
                    if (!message.member.roles.has(botAdminRoleLink.id)) {
                        return 0; // no permissions
                    }
                    if (parsedCommand.args.length !== 1) {
                        reply(message, "Sir, the command is `!cb adminlink [@discord] [[steamid]`");
                        return 0;
                    }
                    let linkPlayerDiscordId = parseDiscordId(parsedCommand.args[0]);

                    User.findOne({where: {discord: linkPlayerDiscordId}}).then(function(linkPlayerUser) {
                        let steamId = null;
                        if (parsedCommand.args.length > 1) {
                            steamId = parsedCommand.args[1];
                        } else {
                            steamId = linkPlayerUser.steam;
                        }
                        linkPlayerUser.update({steam: steamId, steamLinkToken: null}).then(function(result) {
                            reply(message, "Sir, I have linked steam id " + steamId + " to <@" + linkPlayerUser.discord + ">.");
                        }, function(error) {
                            console.log(error);
                        });
                    });
                    break;
                case "admingetsteam":
                    let botAdminGetSteam = message.guild.roles.find(r => r.name === adminRoleName);
                    if (!message.member.roles.has(botAdminGetSteam.id)) {
                        return 0; // no permissions
                    }
                    if (parsedCommand.args.length !== 1) {
                        reply(message, "Sir, the command is `!cb admininfo [@discord]`");
                        return 0;
                    }
                    let infoPlayerDiscordId = parseDiscordId(parsedCommand.args[0]);

                    User.findOne({where: {discord: infoPlayerDiscordId}}).then(function(infoPlayerUser) {
                        reply(message, "<@" + infoPlayerUser.discord + "> is linked to Steam ID: `" + infoPlayerUser.steam + "`.");
                    });
                    break;
                case "admingetdiscord":
                    let botAdminGetDiscord = message.guild.roles.find(r => r.name === adminRoleName);
                    if (!message.member.roles.has(botAdminGetDiscord.id)) {
                        return 0; // no permissions
                    }
                    if (parsedCommand.args.length !== 1) {
                        reply(message, "Sir, the command is `!cb admininfo [@discord]`");
                        return 0;
                    }
                    const steamId = parsedCommand.args[0];

                    if (!parseInt(steamId)) {
                        reply(message, 'Invalid steam id');
                        return 0;
                    }

                    User.findAll({where: {steam: steamId}}).then(players => {
                        let playerDiscordIds = [];

                        // TODO: recheck ranks here
                        players.forEach(player => {
                            playerDiscordIds.push("<@" + player.discord + ">");
                        });

                        reply(message, "Users found for `" + steamId + "`: " + playerDiscordIds.join(", ") + ".");
                    });
                    break;
                case "getrank":
                case "rank":
                    if (parsedCommand.args.length === 1) {
                        let getRankUserDiscordId = parseDiscordId(parsedCommand.args[0]);

                        if (getRankUserDiscordId !== null) {
                            if (!message.guild.member(getRankUserDiscordId)) {
                                reply(message, "Could not find that user on this server.");
                                return 0;
                            }
                            User.findOne({where: {discord: getRankUserDiscordId}}).then(getRankUser => {
                                if (getRankUser === null) {
                                    reply(message, "That user has not linked a steam id yet.");
                                    return 0;
                                }
                                getRankFromSteamId(getRankUser.steam).then(rank => {
                                    user.update({rank: rank.mmr_level, score: rank.score}).then(nothing => {
                                        reply(message, "Current rank for <@" + getRankUser.discord + "> is: `" + getRankString(rank.mmr_level) + "`.");
                                    });
                                });
                            });
                        } else if (parseInt(parsedCommand.args[0])) {
                            let publicSteamId = parsedCommand.args[0];

                            getRankFromSteamId(publicSteamId).then(rank => {
                                user.update({rank: rank.mmr_level, score: rank.score}).then(nothing => {
                                    reply(message, "Current rank for " + publicSteamId + " is: `" + getRankString(rank.mmr_level) + "`.");
                                });
                            });
                        } else {
                            reply(message, "Invalid arguments.");
                        }
                    } else {
                        if (user !== null && user.steam !== null && user.steamLinkToken === null) {
                            getRankFromSteamId(user.steam).then(rank => {
                                reply(message, "Your current rank is: `" + getRankString(rank.mmr_level) + "`.");
                                user.update({rank: rank.mmr_level, score: rank.score}).then(nothing => {
                                    updateRoles(message, nothing, true, false, true, true);
                                });
                            });
                        } else {
                            reply(message, "You have not linked a steam id. See <#542454956825903104> for more information.");
                        }
                    }
                    break;
                case "updateroles":
                case "updateranks":
                case "udpaterank":
                case "roles":
                    updateRoles(message, user);
                    break;
                case "help":
                    reply(message, "See <#542454956825903104> for more information.");
                    break;
                default:
                    // reply(message, "Unhandled bot message: " + message.content);
                    console.log("Unhandled bot message: " + message.content);
            }
        });
    } else {
        // console.debug("Non-bot message: " + message.content);
    }
});

discordClient.on('error', console.error);


function updateRoles(message, user, notify=true, priv=false, mention=true, dontdemote=false) {
    if (user !== null && user.steam !== null) {
        getRankFromSteamId(user.steam).then(rank => {
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

            if (message.member === null) {
                reply(message, "I am having a problem seeing your roles. Are you set to Invisible on Discord?");
            } else {
                ranks.forEach(r => {
                    if (message.member.roles.has(r.role.id)) {
                        if (dontdemote === false) {
                            if (rank.mmr_level < r.rank) {
                                message.member.removeRole(r.role).catch(console.error);
                                removed.push(r.name);
                            }
                        }
                    } else {
                        if (rank.mmr_level >= r.rank) {
                            message.member.addRole(r.role).catch(console.error);
                            added.push(r.name);
                        }
                    }
                });

                if (notify) {
                    let rankStr = getRankString(rank.mmr_level);
                    if (added.length > 0) {
                        reply(message, "Your rank is " + rankStr + ". You have been promoted to: `" + added.join("`, `") + "`", priv, mention);
                    }
                    if (removed.length > 0) {
                        reply(message, "Your rank is " + rankStr + ". You have been demoted from: `" + removed.join("`, `") + "` (sorry!)", priv, mention);
                    }
                    if (added.length === 0 && removed.length === 0 && dontdemote === false) {
                        reply(message, "Your rank is " + rankStr + ". No role changes based on your rank.", priv, mention);
                        if (rankStr === "Error") {
                            reply(message, "I had a problem getting your rank, did you use the right steam id? See <#542454956825903104> for more information. Use `!cb unlink` to start over.", priv, mention);
                        }
                    }
                }
            }
        });
    }}

discordClient.login(config.discord_token);
