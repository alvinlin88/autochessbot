winston = require("winston");

const Discord = require('discord.js'),
    discordClient = new Discord.Client();

const randtoken = require("rand-token");
const fs = require("fs");

global.config = require("./config");

const logger = winston.createLogger({
    level: 'error',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: config.logfile_error, level: 'error' }),
        new winston.transports.File({ filename: config.logfile })
    ]
});

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
        type: Sequelize.TEXT,
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
    logger.info(`Logged in as ${discordClient.user.tag}!`);
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
        logger.info('Sent private message to ' + message.author.username + ': ' + text);
    } else {
        if (mention) {
            message.channel.send('<@' + message.author.id + '> ' + text);
            logger.info('Sent message in channel ' + message.channel.name + ' to ' + message.author.username + ': ' + text);
        } else {
            message.channel.send(text);
            logger.info('Sent message in channel ' + message.channel.name + ': ' + text);
        }
    }
}

function getRankString(rank) {
    if (rank > 0 && rank <= 9) { return "Pawn-" + (rank).toString();}
    if (rank >= 10 && rank < (10 + 9)) { return "Knight-" + (rank - 9).toString(); }
    if (rank >= (10 + 9) && rank < (10 + 9 + 9)) { return "Bishop-" + (rank - 9 - 9).toString(); }
    if (rank >= (10 + 9 + 9) && rank < (10 + 9 + 9 + 9)) { return "Rook-" + (rank - 9 - 9 - 9).toString(); }
    if (rank >= (10 + 9 + 9 + 9)) { return "King-" + (rank - 9 - 9 - 9 - 9).toString(); }
    return "ERROR";
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

            if (res !== undefined && res.hasOwnProperty("statusCode")) {
                if (res.statusCode === 200) {
                    try {
                        // logger.info("Got result from server: " + JSON.stringify(body.user_info));
                        resolve({
                            "mmr_level": body.user_info[steamId.toString()].mmr_level,
                            "score": body.user_info[steamId.toString()].score
                        });
                    } catch (error) {
                        logger.error(error);
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

            if (res !== undefined && res.hasOwnProperty("statusCode")) {
                if (res.statusCode === 200) {
                    try {
                        // logger.info("Got result from server: " + JSON.stringify(body.ranking_info));
                        resolve(body.ranking_info);
                    } catch (error) {
                        logger.error(error);
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

let botDownMessage = "Bot is restarting. Lobby commands are currently disabled. Be back soon!";

let adminRoleName = global.config.adminRoleName;
let leagueRoles = global.config.leagueRoles;
let leagueToLobbiesPrefix = global.config.leagueToLobbiesPrefix;
let lobbiesToLeague = global.config.lobbiesToLeague;
let leagueRequirements = global.config.leagueRequirements;
let leagueChannels = global.config.leagueChannels;
let validRegions = global.config.validRegions;
let regionTags = global.config.regionTags;
let lobbies = {}; // we keep lobbies in memory
let listratelimit = {};
let disableLobbyCommands = false;
let init = false;
let disableLobbyHost = false;
let lastBackup = Date.now();

leagueRoles.forEach(leagueRole => {
    lobbies[leagueToLobbiesPrefix[leagueRole]] = {};
    validRegions.forEach(leagueRegion => {
        lobbies[leagueToLobbiesPrefix[leagueRole] + "-" + leagueRegion.toLowerCase()] = {};
    });
});

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

function getLobbyForHost(leagueChannel, host) {
    let result = null;
    for (let hostId in lobbies[leagueChannel]) {
        if (lobbies[leagueChannel].hasOwnProperty(hostId)) {
            let lobby = lobbies[leagueChannel][hostId];

            if (lobby["host"] === host) {
                result = lobby;
            }
        }
    }
    return result;
}

function getLobbyForPlayer(leagueChannel, player) {
    let result = null;
    for (let hostId in lobbies[leagueChannel]) {
        if (lobbies[leagueChannel].hasOwnProperty(hostId)) {
            let lobby = lobbies[leagueChannel][hostId];

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
                        logger.error(error);
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
                        logger.error(error);
                    }
                }
            }
        });
    });
}

function backUpLobbies() {
    if (Date.now() - lastBackup > 5000) {
        fs.writeFileSync(config.lobbies_file, JSON.stringify(lobbies), (err) => {
            if (err) {
                logger.error(err)
            }
        });
    }
}


discordClient.on('message', message => {
    if (init === false) {
        let lobbiesData = "";
        try {
            lobbiesData = fs.readFileSync(config.lobbies_file, 'utf8');
        } catch (e) {
            fs.writeFileSync(config.lobbies_file, "", (err) => {
                if (err) {
                    logger.error(err)
                }
            });
        }
        if (lobbiesData === "") {
            leagueRoles.forEach(leagueRole => {
                lobbies[leagueToLobbiesPrefix[leagueRole]] = {};
                validRegions.forEach(leagueRegion => {
                    lobbies[leagueToLobbiesPrefix[leagueRole] + "-" + leagueRegion.toLowerCase()] = {};
                });
            });
        } else {
            lobbies = JSON.parse(lobbiesData);
        }
        init = true;
    }

    backUpLobbies();

    if (message.author.bot === true) {
        return 0; // ignore bot messages
    }
    // private message
    if (message.channel.type === "dm") {
        // nothing
    }
    if (message.content.substring(0, PREFIX.length) === PREFIX || message.content.substring(0, 1) === "!") {
        logger.info (" *** Received command: " + message.content);

        const parsedCommand = parseCommand(message);
        const userPromise = User.findOne({where: {discord: message.author.id}});

        if (leagueLobbies.includes(message.channel.name)) {
            let leagueRole = lobbiesToLeague[message.channel.name];
            let leagueChannel = message.channel.name;
            let leagueChannelRegion = leagueChannelToRegion[leagueChannel];
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
                                let hostLobbyEnd = getLobbyForHost(leagueChannel, hostUser.steam);
                                let regionEnd = hostLobbyEnd["region"];

                                delete lobbies[leagueChannel][hostUser.steam];
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
                                let hostLobby = getLobbyForHost(leagueChannel, hostUser.steam);
                                if (hostLobby === null) {
                                    reply(message, "Sir, that person isn't hosting a lobby currently.");
                                    return 0;
                                }
                                if (hostUser.steam === playerUser.steam) {
                                    reply(message, "Sir, you can not kick the host from their own lobby. Use `!cb admincancel [@host]` instead.");
                                    return 0;
                                }

                                let index = lobbies[leagueChannel][hostUser.steam].players.indexOf(playerUser.steam);

                                if (index > -1) {
                                    lobbies[leagueChannel][hostUser.steam].players.splice(index, 1);
                                    let kickUserName = message.client.users.find("id", playerUser.discord);
                                    reply(message, "kicked " + kickUserName + " from @" + hostLobby.region + " region lobby. `(" + lobbies[leagueChannel][hostUser.steam].players.length + "/8)`");
                                }
                            });
                        });
                        break;
                    case "host": // done
                        if (disableLobbyCommands === true) {
                            reply(message, botDownMessage);
                            return 0;
                        }
                        if (disableLobbyHost === true) {
                            reply(message, "Lobby hosting disabled. Bot is going down for maintenance.");
                        }

                        let hostLobbyExist = getLobbyForHost(leagueChannel, user.steam);

                        if (hostLobbyExist !== null) {
                            reply(message, "You are already hosting a lobby.");
                            return 0;
                        }
                        if (parsedCommand.args.length === 0) {
                            if (leagueChannelRegion !== null) {
                                parsedCommand.args[0] = leagueChannelRegion;
                            } else {
                                reply(message, "Invalid arguments. Try `!cb host [" + validRegions.join(', ').toLowerCase() + "] [[Rank-1]]`");
                                return 0;
                            }
                        }

                        let region = parsedCommand.args[0].toUpperCase();

                        if (leagueChannelRegion !== null && leagueChannelRegion !== region) {
                            reply(message, "You can only host " + leagueChannelRegion + " region lobbies in this channel.");
                            return 0;
                        }


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

                            lobbies[leagueChannel][user.steam] = {
                                "host": user.steam,
                                "password": region.toLowerCase() + "_" + token.toLowerCase(),
                                "players": [user.steam],
                                "region": region,
                                "rankRequirement": rankRequirement,
                                "starttime": Date.now(),
                            };

                            let currentLobby = getLobbyForPlayer(leagueChannel, user.steam);

                            reply(message, leagueChannels[leagueChannel] + " " + regionTags[region] + " Lobby started by <@" + user.discord + "> `" + getRankString(rank.mmr_level) + "`. Type \"!cb join <@" + user.discord + ">\" to join! **[**`" + getRankString(lobbies[leagueChannel][user.steam]["rankRequirement"]) + "` **required to join]** The bot will whisper you the password on Discord. Please do not post it here.`(" + currentLobby.players.length + "/8)`", false, false);
                            reply(message, leagueChannels[leagueChannel] + " Please host a private Dota Auto Chess lobby in " + region + " region with the following password: `" + lobbies[leagueChannel][user.steam]["password"] + "`. Please remember to double check people's ranks and make sure the right ones joined the game before starting. Wait until the game has started in the Dota 2 client before typing `!cb start`.", true);
                        });
                        break;
                    case "start": // done
                        if (disableLobbyCommands === true) {
                            reply(message, botDownMessage);
                            return 0;
                        }

                        // check 8/8 then check all ranks, then send passwords
                        let hostLobbyStart = lobbies[leagueChannel][user.steam];

                        if (hostLobbyStart === undefined || hostLobbyStart === null) {
                            reply(message, "You are not hosting any lobbies.");
                            return 0;
                        }

                        let lobby = lobbies[leagueChannel][user.steam];

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
                            lobbies[leagueChannel][user.steam].players.forEach(steamId => {
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

                                    delete lobbies[leagueChannel][user.steam];

                                    reply(message, leagueChannels[leagueChannel] + " @" + hostLobbyStart.region + " region lobby started. Good luck! " + playerDiscordIds.join(" | "));
                                });
                            });
                        } else {
                            if (lobby.players.length === 8) {
                                let wheres = [];
                                lobbies[leagueChannel][user.steam].players.forEach(steamId => {
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

                                        reply(message, leagueChannels[leagueChannel] + " @" + lobbies[leagueChannel][user.steam]["region"] + " region lobby started. Good luck! " + playerDiscordIds.join(" | "));
                                        delete lobbies[leagueChannel][user.steam];
                                    });
                                });
                            } else {
                                reply(message, "Not enough players to start yet. `(" + hostLobbyStart.players.length + "/8)`");
                            }
                        }
                        break;
                    case "join": // done
                        if (disableLobbyCommands === true) {
                            reply(message, botDownMessage);
                            return 0;
                        }

                        let playerLobbyJoin = getLobbyForPlayer(leagueChannel, user.steam);

                        if (playerLobbyJoin !== null) {
                            reply(message, "You are already in a lobby! Use `!cb leave` to leave.");
                            return 0;
                        }
                        if (parsedCommand.args.length === 0) {
                            if (leagueChannelRegion === null) {
                                reply(message, "Need to specify a host or region to join.", true); // TODO: Change to available lobbies.
                                message.delete("Processed").catch(logger.error);
                                return 0;
                            } else {
                                parsedCommand.args[0] = leagueChannelRegion;
                            }
                        }

                        getRankFromSteamId(user.steam).then(rank => {
                            let resultLobbyHostId = null;

                            if (validRegions.includes(parsedCommand.args[0].toUpperCase())) {
                                let region = parsedCommand.args[0].toUpperCase();
                                // find host with most users not over 8 and join.

                                if (lobbies[leagueChannel].length === 0) {
                                    reply(message, "There are no lobbies for that region currently. Use !cb host [" + region + "] to host one!");
                                }
                                for (let currentHostId in lobbies[leagueChannel]) {
                                    if (lobbies[leagueChannel].hasOwnProperty(currentHostId)) {
                                        if (lobbies[leagueChannel][currentHostId].players.length < 8) {
                                            if (rank.mmr_level >= lobbies[leagueChannel][currentHostId]["rankRequirement"] && lobbies[leagueChannel][currentHostId]["region"] === region) {
                                                if (resultLobbyHostId === null) {
                                                    resultLobbyHostId = lobbies[leagueChannel][currentHostId].host;
                                                } else {
                                                    if (lobbies[leagueChannel][currentHostId].players.length > lobbies[leagueChannel][resultLobbyHostId].players.length) {
                                                        resultLobbyHostId = lobbies[leagueChannel][currentHostId].host;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                if (resultLobbyHostId === null) {
                                    reply(message, "Host does not exist or you can not join it. Make sure you have the required rank or a lobby for that region exists. Use `!cb join [@host]` or `!cb join [region]`.", true);
                                    message.delete("Processed").catch(logger.error);

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
                                if (!lobbies[leagueChannel].hasOwnProperty(hostUser.steam)) {
                                    reply(message, "Host not found. Use `!cb list` to see lobbies or `!cb host [region]` to start one!");
                                    return 0;
                                }
                                if (lobbies[leagueChannel][hostUser.steam].players.length === 8) {
                                    reply(message, "Lobby is full.");
                                    return 0;
                                }

                                user.update({rank: rank.mmr_level, score: rank.score});
                                if (rank.mmr_level < leagueRequirements[leagueRole]) {
                                    reply(message, "You are not high enough rank to join lobbies in this league. (Your rank: `" + getRankString(rank.mmr_level) + "`, required league rank: `" + getRankString(leagueRequirements[leagueRole]) + "`)");
                                    return 0;
                                }
                                if (rank.mmr_level < lobbies[leagueChannel][hostUser.steam]["rankRequirement"]) {
                                    reply(message, "You are not high enough rank to join this lobby. (Your rank: `" + getRankString(rank.mmr_level) + "`, required lobby rank: `" + getRankString(lobbies[leagueChannel][hostUser.steam]["rankRequirement"]) + "`)");
                                    return 0;
                                }

                                lobbies[leagueChannel][hostUser.steam].players.push(user.steam);

                                getSteamPersonaNames([user.steam]).then(personaNames => {
                                    reply(message, "<@" + message.author.id + "> \"" + personaNames[user.steam] + "\" `" + getRankString(rank.mmr_level) + "` joined <@" + hostUser.discord + "> @" + lobbies[leagueChannel][hostUser.steam]["region"] + " region lobby. <@" + message.author.id + "> I just whispered you the lobby password.`(" + lobbies[leagueChannel][hostUser.steam].players.length + "/8)`", false, false);
                                    reply(message, leagueChannels[leagueChannel] + " Lobby password for <@" + hostUser.discord + ">" + lobbies[leagueChannel][hostUser.steam]["region"] + " region: `" + lobbies[leagueChannel][hostUser.steam]["password"] + "`", true);
                                    if (lobbies[leagueChannel][hostUser.steam].players.length === 8) {
                                        reply(message, "@" + lobbies[leagueChannel][hostUser.steam]["region"] + " Lobby is full! <@" + hostUser.discord + "> can start the game with `!cb start`. (Only start the game if you have verified everyone in the game lobby)", false, false);
                                    }
                                });
                            });
                        });
                        break;
                    case "leave":
                    case "quit":
                        if (disableLobbyCommands === true) {
                            reply(message, botDownMessage);
                            return 0;
                        }

                        let playerLobbyLeave = getLobbyForPlayer(leagueChannel, user.steam);

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
                            let index = lobbies[leagueChannel][hostUser.steam].players.indexOf(user.steam);
                            if (index > -1) {
                                lobbies[leagueChannel][hostUser.steam].players.splice(index, 1);
                                getSteamPersonaNames([user.steam]).then(personaNames => {
                                    reply(message, "<@" + message.author.id + "> \"" + personaNames[user.steam] + "\" left <@" + hostUser.discord + "> @" + playerLobbyLeave.region + " region lobby. `(" + lobbies[leagueChannel][hostUser.steam].players.length + "/8)`", false, false);
                                    message.delete("Processed").catch(logger.error);
                                });
                            }
                        });
                        break;
                    case "kick":
                        if (disableLobbyCommands === true) {
                            reply(message, botDownMessage);
                            return 0;
                        }

                        let hostLobby = getLobbyForHost(leagueChannel, user.steam);

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

                            let index = lobbies[leagueChannel][hostLobby.host].players.indexOf(kickedPlayerUser.steam);

                            if (index > -1) {
                                lobbies[leagueChannel][hostLobby.host].players.splice(index, 1);
                                let kickUserName = message.client.users.find("id", kickedPlayerDiscordId);
                                reply(message, "kicked " + kickUserName + " from @" + hostLobby.region + " region lobby. `(" + lobbies[leagueChannel][hostLobby.host].players.length + "/8)`");
                            }
                        }, function (error) {
                            reply(message, "DB Error");
                            logger.error(error);
                        });
                        break;
                    case "list":
                    case "lobbies":
                    case "games":
                        if (disableLobbyCommands === true) {
                            reply(message, botDownMessage);
                            return 0;
                        }

                        // Get player info and print out current users in lobby.
                        let numPrinted = 0;

                        if (listratelimit.hasOwnProperty(leagueChannel)) {
                            if (Date.now() - listratelimit[leagueChannel] < 10000) {
                                // rate limited
                                return 0;
                            }
                        }

                        listratelimit[leagueChannel] = Date.now();

                        for (let hostId in lobbies[leagueChannel]) {
                            if (lobbies[leagueChannel].hasOwnProperty(hostId)) {
                                let lobby = lobbies[leagueChannel][hostId];
                                if (lobby.host !== null && lobby.password !== null) {
                                    let wheres = [];

                                    lobby.players.forEach(steamId => {
                                        wheres.push({steam: steamId});
                                    });
                                    User.findAll({where: {[Op.or]: wheres}}).then(players => {
                                        getSteamPersonaNames(lobby.players).then(personas => {
                                            let playerDiscordIds = [];
                                            let hostDiscord = "ERROR";
                                            players.forEach(player => {
                                                if (player.steam !== lobby.host) {
                                                    playerDiscordIds.push("<@" + player.discord + "> \"" + personas[player.steam] + "\" `" + getRankString(player.rank) + "`");
                                                } else {
                                                    hostDiscord = "<@" + player.discord + "> \"" + personas[player.steam] + "\" `" + getRankString(player.rank) + "` **[Host]**";
                                                }
                                            });

                                            reply(message, "@" + lobby.region + " [`" + getRankString(lobby.rankRequirement) + "+`] `(" + lobby.players.length + "/8)` " + hostDiscord + " | " + playerDiscordIds.join(" | ") + ". (" + Math.round((Date.now() - new Date(lobby.starttime)) / 1000 / 60) + "m)", false, false);
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
                            reply(message, botDownMessage);
                            return 0;
                        }

                        let hostLobbyEnd = getLobbyForHost(leagueChannel, user.steam);

                        if (hostLobbyEnd === null) {
                            reply(message, "You are not hosting any lobbies. Use `!cb host [region]` to host one!");
                            return 0;
                        }
                        let regionEnd = hostLobbyEnd["region"];

                        if (user.steam === lobbies[leagueChannel][user.steam]["host"]) {
                            delete lobbies[leagueChannel][user.steam];
                            reply(message, "Lobby for " + regionEnd + " region cancelled.");
                            return 0;
                        }
                        break;
                    default:
                        // reply(message, "Unhandled bot message: " + message.content);
                        // console.log("Unhandled bot message for lobby: " + message.content);
                }
            });
        }

        userPromise.then(user => {
            switch (parsedCommand.command) {
                case "unlink":
                    if (user !== null && user.steam !== null) {
                        user.update({steam: null, steamLinkToken: null, validated: null});
                        // steamFriends.removeFriend(user.steam);
                        // console.log("Removed steam friends " + user.steam);

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

                        if ((user === null && existingUsers.length > 0) || (user !== null && existingUsers.length >= 1)) {
                            reply(message, "**WARNING!** Could not link that steam id. The steam id `" + steamIdLink + "` has already been linked to these accounts: " + playerDiscordIds.join(", ") + ". See <#542494966220587038> for help.");
                            return 0;
                        }

                        if (user === null) {
                            User.create({
                                discord: message.author.id,
                                steam: steamIdLink,
                                validated: true,
                            }).then(test => {
                                // logger.info(test.toJSON());
                                reply(message, "I have linked your steam id `" + steamIdLink + "`. If I do not promote you right away then you probably used the wrong steam id or you are set to Invisible on Discord.");
                                updateRoles(message, test, true, false, true);
                            }).catch(Sequelize.ValidationError, function (msg) {
                                logger.error("error " + msg);
                            });
                        } else {
                            user.update({steam: steamIdLink, validated: true}).then(test => {
                                reply(message, "I have linked your steam id `" + steamIdLink + "`. If I do not promote you right away then you probably used the wrong steam id or you are set to Invisible on Discord.");
                                updateRoles(message, test, true, false, true);
                            });
                        }
                    });

                    // }
                    break;
                case "adminrestartbot":
                    if (message.author.id !== "204094307689431043") {
                        return 0; // no permissions
                    }
                    disableLobbyCommands = true;

                    fs.writeFileSync(config.lobbies_file, JSON.stringify(lobbies), (err) => {
                        if (err) {
                            logger.error(err)
                        }
                    });
                    reply(message, "Saved lobbies. Restarting...");
                    setTimeout(function () {
                        process.exit(1);
                    }, 1000);
                    break;
                case "admindisablebot":
                    if (message.author.id !== "204094307689431043") {
                        return 0; // no permissions
                    }
                    if (disableLobbyCommands === false) {
                        disableLobbyCommands = true;

                        fs.writeFileSync(config.lobbies_file, JSON.stringify(lobbies), (err) => {
                            if (err) {
                                logger.error(err)
                            }
                        });
                        reply(message, "Lobby commands disabled. Lobby data saved.");
                        // reply(message, "```\n" + JSON.stringify(lobbies) + "\n```");
                        return 0;
                    } else {
                        reply(message, "Bot is not enabled.");
                    }
                    break;
                case "adminenablebot":
                    if (message.author.id !== "204094307689431043") {
                        return 0; // no permissions
                    }
                    if (disableLobbyCommands === true) {
                        disableLobbyCommands = false;

                        let lobbiesData = fs.readFileSync(config.lobbies_file, 'utf8');
                        lobbies = JSON.parse(lobbiesData);
                        reply(message, "Lobby data loaded. Lobby commands enabled.");
                        // reply(message, "```\n" + lobbiesData + "\n```");
                        return 0;
                    } else {
                        reply(message, "Bot is not disabled.");
                    }
                    break;
                case "admintogglehost":
                    if (message.author.id !== "204094307689431043") {
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
                case "adminsavelobbies":
                    if (message.author.id !== "204094307689431043") {
                        return 0; // no permissions
                    }
                    fs.writeFileSync(config.lobbies_file, JSON.stringify(lobbies), (err) => {
                        if (err) {logger.error(err)}
                    });
                    reply(message, "Lobby data saved.");
                    break;
                case "adminlobbyinfo":
                    if (message.author.id !== "204094307689431043") {
                        return 0; // no permissions
                    }
                    reply(message, "disableLobbyCommands: " + disableLobbyCommands + ", " + "disableLobbyHost: " + disableLobbyHost);
                    // add lobby sizes
                    break;
                case "adminclearlobbies":
                    if (message.author.id !== "204094307689431043") {
                        return 0; // no permissions
                    }

                    if (parsedCommand.args.length !== 1) {
                        reply(message, "Invalid argument, try: `!adminclearlobbies " + leagueRoles.join(", ") + "`.");
                        return 0;
                    }
                    let role = parsedCommand.args[0];

                    if (!leagueRoles.includes(role)) {
                        reply(message, "Invalid League, try:" + leagueRoles.join(", "));
                    }

                    lobbies[role] = {};
                    reply(message, "Cleared " + role + " lobbies.");

                    fs.writeFileSync(config.lobbies_file, JSON.stringify(lobbies), (err) => {
                        if (err) {logger.error(err)}
                    });
                    break;
                case "adminclearalllobbies":
                    if (message.author.id !== "204094307689431043") {
                        return 0; // no permissions
                    }

                    lobbies = {};

                    leagueChannels.forEach(leagueChannel => {
                        lobbies[leagueChannel] = {};
                    });
                    fs.writeFileSync(config.lobbies_file, JSON.stringify(lobbies), (err) => {
                        if (err) {
                            logger.error(err)
                        }
                    });

                    reply(message, "All lobbies cleared.");
                    break;
                case "adminlink":
                    let botAdminRoleLink = message.guild.roles.find(r => r.name === adminRoleName);
                    if (!message.member.roles.has(botAdminRoleLink.id)) {
                        return 0; // no permissions
                    }
                    if (parsedCommand.args.length < 1) {
                        reply(message, "Sir, the command is `!cb adminlink [@discord] [[steamid]]`");
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
                            logger.error(error);
                        });
                    });
                    break;
                case "adminunlink":
                    let botAdminRoleUnlink = message.guild.roles.find(r => r.name === adminRoleName);
                    if (!message.member.roles.has(botAdminRoleUnlink.id)) {
                        return 0; // no permissions
                    }
                    if (parsedCommand.args.length !== 1) {
                        reply(message, "Sir, the command is `!cb adminunlink [@discord]`");
                        return 0;
                    }
                    let unlinkPlayerDiscordId = parseDiscordId(parsedCommand.args[0]);

                    User.findOne({where: {discord: unlinkPlayerDiscordId}}).then(function(unlinkPlayerUser) {
                        unlinkPlayerUser.update({steam: null, validated: false}).then(function(result) {
                            reply(message, "Sir, I have unlinked <@" + unlinkPlayerUser.discord + ">'s steam id.");
                        }, function(error) {
                            logger.error(error);
                        });
                    });
                    break;
                case "adminunlinksteam":
                    let botAdminRoleUnlinkSteam = message.guild.roles.find(r => r.name === adminRoleName);
                    if (!message.member.roles.has(botAdminRoleUnlinkSteam.id)) {
                        return 0; // no permissions
                    }
                    if (parsedCommand.args.length !== 1) {
                        reply(message, "Sir, the command is `!cb adminunlink [steamid]`");
                        return 0;
                    }
                    if (!parseInt(parsedCommand.args[0])) {
                        reply(message, 'Invalid steam id');
                        return 0;
                    }
                    let unlinkPlayerSteamId = parsedCommand.args[0];

                    User.findAll({where: {steam: unlinkPlayerSteamId}}).then(function(unlinkPlayerUsers) {
                        unlinkPlayerUsers.forEach(unlinkPlayerUser => {
                            reply(message, "Sir, I have unlinked <@" + unlinkPlayerUser.discord + ">'s steam id.");
                            unlinkPlayerUser.update({steam: null, validated: false});
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

                        if (playerDiscordIds.length >= 1) {
                            reply(message, "Users found for `" + steamId + "`: " + playerDiscordIds.join(", ") + ".");
                        } else {
                            reply(message, "Did not find any matches in database for `" + steamId + "`.");
                        }
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
                                    reply(message, "Current rank for <@" + getRankUser.discord + "> is: `" + getRankString(rank.mmr_level) + "`.");
                                });
                            });
                        } else if (parseInt(parsedCommand.args[0])) {
                            let publicSteamId = parsedCommand.args[0];

                            getRankFromSteamId(publicSteamId).then(rank => {
                                reply(message, "Current rank for " + publicSteamId + " is: `" + getRankString(rank.mmr_level) + "`.");
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
                case "getsteampersona":
                case "steampersona":
                    if (parsedCommand.args.length === 1) {
                        let getSteamPersonaUserDiscordId = parseDiscordId(parsedCommand.args[0]);

                        if (getSteamPersonaUserDiscordId !== null) {
                            if (!message.guild.member(getSteamPersonaUserDiscordId)) {
                                reply(message, "Could not find that user on this server.");
                                return 0;
                            }
                            User.findOne({where: {discord: getSteamPersonaUserDiscordId}}).then(getSteamPersonaUser => {
                                getSteamPersonaNames([getSteamPersonaUser.steam]).then(personas => {
                                    reply(message, "<@" + getSteamPersonaUser.discord + "> Steam Name is \"" + personas[getSteamPersonaUser.steam] + "\"");
                                });
                            });
                        } else {
                            reply(message, "Invalid arguments.");
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
                    logger.info("Unhandled bot message: " + message.content);
            }
        });
    } else {
        // console.debug("Non-bot message: " + message.content);
    }
});

discordClient.on('error', logger.error);


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
                                message.member.removeRole(r.role).catch(logger.error);
                                removed.push(r.name);
                            }
                        }
                    } else {
                        if (rank.mmr_level >= r.rank) {
                            message.member.addRole(r.role).catch(logger.error);
                            added.push(r.name);
                        }
                    }
                });

                if (notify) {
                    let rankStr = getRankString(rank.mmr_level);
                    if (added.length > 0) {
                        reply(message, "Your rank is `" + rankStr + "`. You have been promoted to: `" + added.join("`, `") + "`", priv, mention);
                    }
                    if (removed.length > 0) {
                        reply(message, "Your rank is `" + rankStr + "`. You have been demoted from: `" + removed.join("`, `") + "` (sorry!)", priv, mention);
                    }
                    if (added.length === 0 && removed.length === 0 && dontdemote === false) {
                        reply(message, "Your rank is `" + rankStr + "`. No role changes based on your rank.", priv, mention);
                        if (rankStr === "ERROR") {
                            reply(message, "I had a problem getting your rank, did you use the right steam id? See <#542454956825903104> for more information. Use `!cb unlink` to start over.", priv, mention);
                        }
                    }
                }
            }
        });
    }}

discordClient.login(config.discord_token);
