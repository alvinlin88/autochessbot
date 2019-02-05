const Discord = require('discord.js'),
    discordClient = new Discord.Client(),
    steam = require('steam'),
    steamClient = new steam.SteamClient(),
    steamUser = new steam.SteamUser(steamClient),
    steamFriends = new steam.SteamFriends(steamClient),
    dota2 = require('dota2'),
    Dota2 = new dota2.Dota2Client(steamClient, true);


const util = require("util"),
    crypto = require("crypto"),
    fs = require("fs"),
    Long = require("long"),
    randtoken = require("rand-token");

global.config = require("./config");

// Load in server list if we've saved one before
if (fs.existsSync('servers')) {
    steam.servers = JSON.parse(fs.readFileSync('servers'));
}

const request = require('request');

const express = require('express'),
    exphbs = require('express-handlebars'),
    path = require('path'),
    app = express(),
    port = 80;

var session = require('express-session');
var cookieParser = require('cookie-parser');

app.use(cookieParser);
app.use(session({
    secret: 'autochesssucks11111', // Change this to anything else
    resave: true,
    saveUninitialized: false,
}));

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
    steamLinkToken: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
});

User.sync();


let passport = require('passport');
let SteamStrategy = require('passport-steam').Strategy;
passport.use(new SteamStrategy({
        apiKey: "",
        returnURL: 'http://autochessbot.vinthian.com/auth/openid/callback',
        realm: 'http://autochessbot.vinthian.com/',
    },
    function(identifier, profile, done) {
        console.log(identifier);
        return done(null, {
            identifier: identifier,
            steamId: identifier.match(/\d+$/)[0]
        });
    }));


passport.serializeUser(function(user, done) {
    done(null, user.identifier);
});

passport.deserializeUser(function(identifier, done) {
    // For this demo, we'll just return an object literal since our user
    // objects are this trivial.  In the real world, you'd probably fetch
    // your user object from your database here.
    done(null, {
        identifier: identifier,
        steamId: identifier.match(/\d+$/)[0]
    });
});

app.use(passport.initialize());
app.use(passport.session());

app.post('/auth/steam', function(req, res, next) {
    req.session.discordId = req.params.discordId;
    next();
},
    passport.authenticate('steam')
);

app.get('/auth/openid/callback', passport.authenticate('steam'),
    function(request, response) {
        console.log(request.session);
        console.log(request.cookies);
        if (request.user) {
            response.redirect('/link?steamid=' + request.user.steamId);
        } else {
            response.redirect('/link?failed');
        }
    });

app.post('/auth/logout', function(request, response) {
    request.logout();
    // After logging out, redirect the user somewhere useful.
    // Where they came from or the site root are good choices.
    response.redirect(request.get('Referer') || '/link')
});

app.get('/link', function(request, response) {
    response.cookie('discordId', request.query.discordId);
    response.write('<!DOCTYPE html>');
    if (request.user) {
        response.write(request.session.passport &&
            JSON.stringify(request.user) || 'None');
        response.write('<form action="/auth/logout" method="post">');
        response.write('<input type="submit" value="Log Out"/></form>');
    } else {
        if (request.query.steamid) {
            response.write('Not logged in.');
        }
        response.write('<form action="/auth/steam" method="post">');
        response.write(
            '<input name="submit" type="image" src="http://steamcommunity-a.' +
            'akamaihd.net/public/images/signinthroughsteam/sits_small.png" ' +
            'alt="Sign in through Steam"/></form>');
    }
    response.send();
});

app.engine('.hbs', exphbs({
    defaultLayout: 'main',
    extname: '.hbs',
    layoutsDir: path.join(__dirname, 'views/layouts')
}));
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (request, response) => {
    response.render('home', {
        name: 'Chess'
    });
});

app.listen(port, (err) => {
    if (err) {
        return console.log("err!", err)
    }

    console.log("server started");
});


PREFIX = "!cb ";

discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}!`);
});

function parseCommand(message) {
    const args = message.content.slice(PREFIX.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    return {command: command, args: args};
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
    if (rank >= (10 + 9 + 9 + 9)) { return "King" + (rank - 9 - 9 - 9 - 9).toString(); }
    return "Error";
}

function getRankFromSteamId(steamId) {
    return new Promise(function(resolve, reject) {
        request('http://101.200.189.65:431/dac/heros/get/@' + steamId, { json: true}, (err, res, body) => {
            if (err) { reject(err); }

            if (res.statusCode === 200) {
                try {
                    console.log("Got result from server: " + JSON.stringify(body.user_info));
                    resolve(body.user_info[steamId.toString()].mmr_level);
                } catch(error) {
                    console.log(error);
                }
            }
        });
    });
}

function getRanksFromSteamIdList(steamIdList) {
    return new Promise(function(resolve, reject) {
        request('http://101.200.189.65:431/dac/ranking/get?player_ids=' + steamIdList.join(','), { json: true}, (err, res, body) => {
            if (err) { reject(err); }

            if (res.statusCode === 200){
                try {
                    console.log("Got result from server: " + JSON.stringify(body.ranking_info));
                    resolve(body.ranking_info);
                } catch (error) {
                    console.log(error);
                }
            }
        });
    });
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


leagueRoles.forEach(leagueRole => {
    lobbies[leagueRole] = {};
    validRegions.forEach(region => {
        lobbies[leagueRole][region] = {
            "host": null,
            "players": [],
            "password": null,
        }
    });
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
    for (let region in lobbies[leagueRole]) {
        if (lobbies[leagueRole].hasOwnProperty(region)) {
            let lobby = lobbies[leagueRole][region];

            if (lobby["host"] === host) {
                lobby["region"] = region;
                result = lobby;
            }
        }
    }
    return result;
}

function getLobbyForPlayer(leagueRole, player) {
    let result = null;
    for (let region in lobbies[leagueRole]) {
        if (lobbies[leagueRole].hasOwnProperty(region)) {
            let lobby = lobbies[leagueRole][region];

            lobby["players"].forEach(p => {
                if (p === player) {
                    lobby["region"] = region;
                    result = lobby;
                }
            });
        }
    }
    return result;
}


discordClient.on('message', message => {
    if (message.author.bot === true) {
        return 0; // ignore bot messages
    }
    // private message
    if (message.channel.type === "dm") {
        // nothing
    }
    if(message.content.substring(0, PREFIX.length) === PREFIX) {
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
                if (user !== null && user.steam !== null) {
                    switch (parsedCommand.command) {
                        case "adminend":
                            let botAdminRoleEnd = message.guild.roles.find(r => r.name === adminRoleName);
                            if (message.member.roles.has(botAdminRoleEnd.id)) {
                                if (parsedCommand.args.length > 0) {
                                    let region = parsedCommand.args[0].toUpperCase();

                                    lobbies[leagueRole][region] = {
                                        "host": null,
                                        "players": [],
                                        "password": null,

                                    };

                                    reply(message, "Lobby ended, sir.");
                                } else {
                                    reply(message, "Sir, the command is `!cb adminend [region]`.");
                                }
                            } else {
                                // no permissions
                            }
                            break;
                        case "adminkick":
                            let botAdminRoleKick = message.guild.roles.find(r => r.name === adminRoleName);
                            if (message.member.roles.has(botAdminRoleKick.id)) {
                                if (parsedCommand.args.length > 1) {
                                    let region = parsedCommand.args[0].toUpperCase();
                                    if (validRegions.includes(region.toUpperCase())) {
                                        let kickedPlayerDiscordId = parsedCommand.args[1].substring(2, parsedCommand.args[1].length - 1);

                                        User.findOne({where: {discord: kickedPlayerDiscordId}}).then(function (kickedPlayerUser) {
                                            if (kickedPlayerUser === null) {
                                                reply(message, "Sir, that user is not in the database.");
                                            } else {
                                                if (lobbies[leagueRole][region].host === kickedPlayerUser.steam) {
                                                    reply(message, "Sir, you can't kick the host from their own lobby. Use `!cb adminend " + region.toLowerCase() + "` instead.");
                                                } else {
                                                    if (lobbies[leagueRole][region].players.includes(kickedPlayerUser.steam)) {
                                                        let index = lobbies[leagueRole][region].players.indexOf(kickedPlayerUser.steam);
                                                        if (index > -1) {
                                                            lobbies[leagueRole][region].players.splice(index, 1);
                                                            let kickUserName = message.client.users.find("id", kickedPlayerDiscordId);
                                                            reply(message, "Sir, I kicked " + kickUserName + " from " + region + " region lobby. `(" + lobbies[leagueRole][region].players.length + "/8)`");
                                                        }
                                                    } else {
                                                        reply(message, "Sir, that user not in lobby.");
                                                    }
                                                }
                                            }
                                        }, function (error) {
                                            reply(message, "DB Error");
                                            console.log(error);
                                        });
                                    } else {
                                        reply(message, "Sir, That's an invalid region.");
                                    }
                                } else {
                                    reply(message, "Sir, the command is `!cb adminkick [region] [@username]`.");
                                }
                            }
                            break;
                        case "host":
                            for (let region in lobbies[leagueRole]) {
                                if (lobbies[leagueRole].hasOwnProperty(region)) {
                                    let lobby = lobbies[leagueRole][region];
                                    if (user.steam === lobby["host"]) {
                                        reply(message, "You are already hosting a lobby.");
                                        return 0;
                                    }
                                }
                            }
                            if (parsedCommand.args.length > 0) {
                                let region = parsedCommand.args[0].toUpperCase();
                                if (validRegions.includes(region)) {
                                    // create lobby
                                    if (lobbies[leagueRole][region]["host"] === null && lobbies[leagueRole][region]["password"] === null) {
                                        // good to start
                                        lobbies[leagueRole][region]["host"] = user.steam;
                                        let token = randtoken.generate(5);
                                        lobbies[leagueRole][region]["password"] = region + "_" + token;
                                        lobbies[leagueRole][region]["players"] = [user.steam];

                                        let currentLobby = getLobbyForPlayer(leagueRole, user.steam);

                                        getRankFromSteamId(user.steam).then(rank => {
                                            reply(message, leagueChannels[leagueRole] + " " + regionTags[region] + " Lobby started by <@" + user.discord + "> (" + getRankString(rank) + "). Type `!cb join " + region.toLowerCase() + "` to join! `(" + currentLobby.players.length + "/8)`", false, false);
                                        });
                                        reply(message, leagueChannels[leagueRole] + " Please host a private Dota Auto Chess lobby in " + region + " region with the following password: `" + lobbies[leagueRole][region]["password"] + "`", true);
                                    } else {
                                        reply(message, "There is already a lobby for " + region + " region in " + leagueChannels[leagueRole] + ". Use `!cb join " + region.toLowerCase() + "` to join it.");
                                    }
                                } else {
                                    reply(message, "Invalid region. Must be [" + validRegions.join(', ') + "]");
                                }
                            } else {
                                reply(message, "Need to specify region. Must be [" + validRegions.join(', ') + "]");
                            }
                            break;
                        case "start":
                            // check 8/8 then check all ranks, then send passwords
                            let hostLobbyStart = getLobbyForHost(leagueRole, user.steam);

                            if (hostLobbyStart !== null) {
                                let lobby = lobbies[leagueRole][hostLobbyStart.region];

                                if (parsedCommand.args.length > 0) {
                                    let force = parsedCommand.args[0];

                                    if (force === "force") {
                                        if (lobby.players.length >= 2) {
                                            let wheres = [];
                                            lobbies[leagueRole][hostLobbyStart.region].players.forEach(steamId => {
                                                wheres.push({steam: steamId});
                                            });
                                            User.findAll({where: {[Op.or]: wheres}}).then(players => {
                                                let playerDiscordIds = [];

                                                // TODO: recheck ranks here
                                                players.forEach(player => {
                                                    playerDiscordIds.push("<@" + player.discord + ">");
                                                });

                                                lobbies[leagueRole][hostLobbyStart.region] = {
                                                    "host": null,
                                                    "players": [],
                                                    "password": null,
                                                };
                                                reply(message, leagueChannels[leagueRole] + " " + hostLobbyStart.region + " region lobby started. Good luck! " + playerDiscordIds.join(" "));
                                            });
                                        } else {
                                            reply(message, "You need at least 2 players to force start a lobby. `(" + hostLobbyStart.players.length + "/8)`");
                                        }
                                    } else {
                                        reply(message, "Invalid arguments");
                                    }
                                } else {
                                    if (lobby.players.length === 8) {
                                        lobbies[leagueRole][hostLobbyStart.region] = {
                                            "host": null,
                                            "players": [],
                                            "password": null,
                                        };
                                        // TODO: recheck ranks here
                                        reply(message, leagueChannels[leagueRole] + " " + hostLobbyStart.region + " region lobby started. Good luck!");
                                    } else {
                                        reply(message, "Not enough players to start yet. `(" + hostLobbyStart.players.length + "/8)`");
                                    }
                                }
                            } else {
                                reply(message, "You are not hosting any lobbies.");
                            }
                            break;
                        case "join":
                            let playerLobbyJoin = getLobbyForPlayer(leagueRole, user.steam);
                            if (parsedCommand.args.length > 0) {
                                let region = parsedCommand.args[0].toUpperCase();

                                if (validRegions.includes(region)) {
                                    if (lobbies[leagueRole][region].host !== null && lobbies[leagueRole][region].password !== null) {
                                        if (playerLobbyJoin === null) {
                                            // CHECK rank here.
                                            getRankFromSteamId(user.steam).then(rank => {
                                                lobbies[leagueRole][region].players.push(user.steam);

                                                reply(message, "<@" + message.author.id + "> (" + getRankString(rank) + ") joined " + region + " region lobby. `(" + lobbies[leagueRole][region].players.length + "/8)`", false, false);
                                                reply(message, leagueChannels[leagueRole] +" Lobby password for " + region + " region: `" + lobbies[leagueRole][region]["password"] + "`", true);
                                                if (lobbies[leagueRole][region].players.length === 8) {
                                                    User.findOne({where: {steam: lobbies[leagueRole][region].host}}).then(hostUser => {
                                                        reply(message, regionTags[region] + " Lobby is full! <@" + hostUser.discord + "> can start the game with `!cb start`.", false, false);
                                                    });
                                                }
                                                // message.delete("Processed").catch(console.error);
                                            });
                                        } else {
                                            reply(message, "You are already in a lobby! (" + playerLobbyJoin.region + ")");
                                        }
                                    } else {
                                        reply(message, "Lobby not found. Use `!cb start " + region.toLowerCase() + "` to start one!");
                                    }
                                } else {
                                    reply(message, "Invalid region. Must be [" + validRegions.join(', ').toLowerCase() + "]"); // TODO: Change to available lobbies.
                                }
                            } else {
                                reply(message, "Need to specify region. Must be [" + validRegions.join(', ').toLowerCase() + "]"); // TODO: Change to available lobbies.
                            }
                            break;
                        case "leave":
                            let playerLobbyLeave = getLobbyForPlayer(leagueRole, user.steam);

                            if (playerLobbyLeave !== null) {
                                if (playerLobbyLeave.host === user.steam) {
                                    reply(message, "Hosts should use `!cb end` instead of `!cb leave`");
                                } else {
                                    let index = lobbies[leagueRole][playerLobbyLeave.region].players.indexOf(user.steam);
                                    if (index > -1) {
                                        lobbies[leagueRole][playerLobbyLeave.region].players.splice(index, 1);
                                        reply(message, message.author.username + " left " + playerLobbyLeave.region + " region lobby. `(" + lobbies[leagueRole][playerLobbyLeave.region].players.length + "/8)`", false, false);
                                        // message.delete("Processed").catch(console.error);
                                    }
                                }
                            } else {
                                reply(message, "You are not in any lobbies.");
                            }
                            break;
                        case "kick":
                            let hostLobby = getLobbyForHost(leagueRole, user.steam);

                            if (hostLobby !== null) {
                                if (parsedCommand.args.length > 0) {
                                    let kickedPlayerDiscordId = parsedCommand.args[0].substring(2, parsedCommand.args[0].length - 1);

                                    if (message.guild.member(kickedPlayerDiscordId)) {
                                        User.findOne({where: {discord: kickedPlayerDiscordId}}).then(function (kickedPlayerUser) {
                                            if (kickedPlayerUser === null) {
                                                reply(message, "User not in database. Make sure to use mentions in command: `!cb kick @username`");
                                            } else {
                                                if (hostLobby.players.includes(kickedPlayerUser.steam)) {
                                                    let index = lobbies[leagueRole][hostLobby.region].players.indexOf(kickedPlayerUser.steam);
                                                    if (index > -1) {
                                                        lobbies[leagueRole][hostLobby.region].players.splice(index, 1);
                                                        let kickUserName = message.client.users.find("id", kickedPlayerDiscordId);
                                                        reply(message, "kicked " + kickUserName + " from " + hostLobby.region + " region lobby. `(" + lobbies[leagueRole][hostLobby.region].players.length + "/8)`");
                                                    }
                                                } else {
                                                    reply(message, "User not in lobby.");
                                                }
                                            }
                                        }, function (error) {
                                            reply(message, "DB Error");
                                            console.log(error);
                                        });
                                    } else {
                                        reply(message, "Could not find that user on this server.");
                                    }
                                } else {
                                    reply(message, "You need to specify a player to kick: `!cb kick @quest`");
                                }
                            } else {
                                reply(message, "You are not hosting any lobbies.");
                            }

                            break;
                        case "list":
                            // // Get player info and print out current users in lobby.
                            // for (let region in lobbies) {
                            //     if (lobbies.hasOwnProperty(region)) {
                            //         let lobby = lobbies[region];
                            //
                            //         if (lobby.host !== null && lobby.password !== null) {
                            //             getRanksFromSteamIdList(lobby.players).then(rankingInfo => {
                            //                 let ranksPromises = [];
                            //                 rankingInfo.forEach(rankingInfoObject => {
                            //                     if (rankingInfoObject.hasOwnProperty("player")) {
                            //                         User.findOne({where: {steam: rankingInfoObject.player}}).then(function(userObj) {
                            //
                            //                     }
                            //                 });
                            //
                            //                 reply(message, region + ": " + rankings);
                            //             });
                            //         }
                            //     }
                            // }
                            break;
                        case "end":
                            let hostLobbyEnd = getLobbyForHost(leagueRole, user.steam);

                            if (hostLobbyEnd !== null) {
                                if (user.steam === lobbies[leagueRole][hostLobbyEnd.region]["host"]) {
                                    lobbies[leagueRole][hostLobbyEnd.region] = {
                                        "host": null,
                                        "players": [],
                                        "password": null,
                                    };
                                    reply(message, "Lobby for " + hostLobbyEnd.region + " region ended.");
                                    return 0;
                                }
                            } else {
                                reply(message, "You are not hosting any lobbies.");
                            }
                            break;
                        default:
                            // reply(message, "Unhandled bot message: " + message.content);
                            console.log("Unhandled bot message: " + message.content);
                    }
                }
            });
        }

        userPromise.then(user => {
            switch (parsedCommand.command) {
                case "unlink":
                    if (user !== null && user.steam !== null) {
                        user.update({steam: null, steamLinkToken: null});
                        steamFriends.removeFriend(user.steam);
                        console.log("Removed steam friends " + user.steam);

                        reply(message, "You have successfully unlinked your account.");
                    } else {
                        reply(message, "You have not linked a steam id.");
                    }
                    break;
                case "link":
                    const steamIdLink = parsedCommand.args[0];

                    if (user !== null && user.steam !== null && user.steamLinkToken === null) {
                        reply(message, "You are already linked a steam id.");
                    } else if (user !== null && user.steam !== null && user.steamLinkToken !== null) {
                        reply(message, "You already tried linking an account. Please type `!cb resendtoken` to resent the verification token.");
                    } else if (user === null || (user !== null && user.steam === null && user.steamLinkToken === null)) {

                        if (!parseInt(steamIdLink)) {
                            reply(message, 'Invalid steam id');
                            return 0;
                        }

                        const token = randtoken.generate(6);

                        if (user === null) {
                            User.create({
                                discord: message.author.id,
                                steam: steamIdLink,
                                rank: null,
                                steamLinkToken: token,
                            }).then(test => {
                                console.log(test.toJSON());
                            }).catch(Sequelize.ValidationError, function (msg) {
                                console.log("error " + msg);
                            });
                        } else {
                            user.update({steam: steamIdLink, steamLinkToken: token});
                        }

                        steamFriends.addFriend(steamIdLink);
                        console.log("Added " + steamIdLink + " to friends.");

                        steamFriends.sendMessage(steamIdLink, "Send the following message in the Discord to verify: \"!cb verify " + token + "\"");
                        console.log("Sent message to " + steamIdLink + ": Send the following message in the Discord to verify: \"!cb verify " + token + "\"");
                        reply(message, "I have sent you a verification token message on steam. Please check your messages and paste the token here in this format: `!cb verify [token]` (If you didn't get a token you can resend it with `!cb resendtoken`)", true);
                        // linkSteamId(message, steamIdLink);
                    }
                    break;
                case "adminvalidate":
                    let botAdminRoleValidate = message.guild.roles.find(r => r.name === adminRoleName);
                    if (message.member.roles.has(botAdminRoleValidate.id)) {
                        if (parsedCommand.args.length > 0) {
                            let validatePlayerDiscordId = parsedCommand.args[0].substring(2, parsedCommand.args[0].length - 1);

                            User.findOne({where: {discord: validatePlayerDiscordId}}).then(function(validatePlayerUser) {
                                let steamId = null;
                                if (parsedCommand.args.length > 1) {
                                    steamId = parsedCommand.args[1];
                                } else {
                                    steamId = validatePlayerUser.steam;
                                }
                                validatePlayerUser.update({steam: steamId, steamLinkToken: null}).then(function(result) {
                                    reply(message, "Sir, I have linked steam id " + steamId + " to <@" + validatePlayerUser.discord + ">.");
                                }, function(error) {
                                    console.log(error);
                                });
                            });
                        } else {
                            reply(message, "Sir, the command is `!cb adminvalidate [@discord] [[steamid]`");
                        }
                    } else {
                        // no permissions
                    }
                    break;
                case "verify":
                    if (user !== null) {
                        if (user.steamLinkToken !== null) {
                            if (parsedCommand.args.length > 0) {
                                let code = parsedCommand.args[0];

                                if (code.length === 6) { // "verify 123456"

                                    if (code === user.steamLinkToken) {
                                        user.update({steamLinkToken: null});
                                        reply(message, "You've successfully linked your steam id! To update your roles, go to the <#540366877176889383> channel and type `!cb updateroles`", true);
                                        steamFriends.removeFriend(user.steam);
                                        console.log("Removed steam friends " + user.steam);
                                        if (message.channel.type !== "dm") {
                                            message.delete("Account verified. Deleting code.").catch(console.error);
                                        }
                                    }
                                } else {
                                    // invalid code length
                                    reply(message, "Invalid code length.");
                                }
                            } else {
                                // invalid argument length
                                reply(message, "Format is: `cb verify [code]`.");
                            }
                        } else {
                            // doesn't need validation
                            reply(message, "Your account doesn't need validation.");
                        }
                    } else {
                        // hasn't started linking
                    }
                    break;
                case "resendtoken":
                    if (user !== null) {
                        if (user.steamLinkToken !== null) {
                            steamFriends.addFriend(user.steam);
                            steamFriends.sendMessage(user.steam, "Send the following message in Discord to verify: \"!cb verify " + user.steamLinkToken + "\"");

                            console.log("Sent message to " + user.steam + ": Send the following message in Discord to verify: \"!cb verify " + user.steamLinkToken + "\"");
                            reply(message, "I have sent you a verification code message on steam. Please check your messages and paste the code here in this format: `!cb verify [code]` (If you didn't get a code you can resend it with `!cb resendtoken`)", true);
                            // steamFriends.removeFriend(user.steam);
                            // console.log("Removed steam friends " + user.steam);
                        } else {
                            console.log("error... couldn't find token in db to resend.");
                        }
                    } else {
                        reply(message, "You have not started linking an account yet. Use `!cb link [steamid]` to link a steam id.");
                    }
                    break;
                case "getrank":
                    if (parsedCommand.args.length === 1) {
                        if (parsedCommand.args[0].substring(1, 2) === "@") {
                            let getRankUserDiscordId = parsedCommand.args[0].substring(2, parsedCommand.args[0].length - 1);

                            if (message.guild.member(getRankUserDiscordId)) {
                                User.findOne({where: {discord: getRankUserDiscordId}}).then(getRankUser => {
                                    if (getRankUser !== null) {
                                        getRankFromSteamId(getRankUser.steam).then(rank => {
                                            reply(message, "Current rank for <@" + getRankUser.discord + "> is: " + getRankString(rank));
                                        });
                                    } else {
                                        reply(message, "That user has not linked a steam id yet.");
                                    }
                                });
                            } else {
                                reply(message, "Could not find that user on this server.");
                            }
                        } else if (!parseInt(parsedCommand.args[0])) {
                            let publicSteamId = parsedCommand.args[0];

                            getRankFromSteamId(publicSteamId).then(rank => {
                                reply(message, "Current rank for " + publicSteamId + " is: " + getRankString(rank));
                            });
                        } else {
                            reply(message, "Invalid arguments.");
                        }
                    } else {
                        if (user !== null && user.steam !== null && user.steamLinkToken === null) {
                            getRankFromSteamId(user.steam).then(rank => {
                                reply(message, "Your current rank is: " + getRankString(rank));
                                user.update({rank: rank});
                            });
                        } else {
                            reply(message, "You have not linked a steam id.");
                        }
                    }
                    break;
                case "updateroles":
                    if (message.channel.name === "roles") {
                        updateRoles(message, user);
                    }
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


function updateRoles(message, user, notify=true) {
    if (user !== null && user.steam !== null && user.steamLinkToken === null) {
        getRankFromSteamId(user.steam).then(rank => {
            user.update({rank: rank});

            let ranks = [];

            leagueRoles.forEach(leagueRole => {
                ranks.push({
                    name: leagueRole,
                    rank: leagueRequirements[leagueRole],
                    role: message.guild.roles.find(r => r.name === leagueRole),
                })
            });

            let added = [];
            let removed = [];

            ranks.forEach(r => {
                if (message.member.roles.has(r.role.id)) {
                    if (rank < r.rank) {
                        message.member.removeRole(r.role).catch(console.error);
                        removed.push(r.name);
                    }
                } else {
                    if (rank >= r.rank) {
                        message.member.addRole(r.role).catch(console.error);
                        added.push(r.name);
                    }
                }
            });

            if (notify) {
                if (added.length > 0) {
                    reply(message, "Your rank is " + getRankString(rank) + ". You've been promoted to: `" + added.join("`, `") + "`");
                }
                if (removed.length > 0) {
                    reply(message, "Your rank is " + getRankString(rank) + ". You've been demoted from: `" + removed.join("`, `") + "` (sorry!)");
                }
                if (added.length === 0 && removed.length === 0) {
                    reply(message, "Your rank is " + getRankString(rank) + ". No role changes based on your rank.");
                }
            }
        });
    }}


let onSteamLogOn = function onSteamLogOn(logonResp) {
    if (logonResp.eresult === steam.EResult.OK) {
        steamFriends.setPersonaState(steam.EPersonaState.Busy); // to display your steamClient's status as "Online"
        steamFriends.setPersonaName("ChessBot"); // to change its nickname
        console.log("Logged on.");
        Dota2.launch();
        Dota2.on("ready", function () {
            console.log("Node-dota2 ready.");
            // Dota2.requestFriendPracticeLobbyList([dota2.ServerRegion.USEAST]);

            // Dota2.createPracticeLobby({
            //         "game_name": "test",
            //         "server_region": dota2.ServerRegion.USEAST,
            //         // "game_mode": dota2.schema.lookupEnum('DOTA_GameMode').values.DOTA_GAMEMODE_AP,
            //         // "series_type": 2,
            //         // "game_version": 1,
            //         // "allow_cheats": false,
            //         // "fill_with_bots": false,
            //         // "allow_spectating": true,
            //         "pass_key": "p123",
            //         // "radiant_series_wins": 0,
            //         // "dire_series_wins": 0,
            //         // "allchat": true
            //         "custom_game_id": Long("1350425247"),
            //         "custom_game_mode": "DOTA AUTO CHESS",
            //         "custom_map_name": "normal",
            //
            //     },
            //     function(err, body){
            //         console.log(JSON.stringify(body));
            //     });
        });
        Dota2.on("friendPracticeLobbyListData", function (lobbies) {
            console.log(lobbies);
        });
        Dota2.on("unready", function onUnready() {
            console.log("Node-dota2 unready.");
        });
        Dota2.on("chatMessage", function (channel, personaName, message) {
            // util.log([channel, personaName, message].join(", "));
        });
        Dota2.on("guildInvite", function (guildId, guildName, inviter) {
            // Dota2.setGuildAccountRole(guildId, 75028261, 3);
        });
        Dota2.on("unhandled", function (kMsg) {
            console.log("UNHANDLED MESSAGE " + dota2._getMessageName(kMsg));
        });
        // setTimeout(function(){ Dota2.exit(); }, 5000);
    }
};

let onSteamServers = function onSteamServers(servers) {
    console.log("Received servers.");
    fs.writeFile('servers', JSON.stringify(servers), (err) => {
        if (err) {
            if (this.debug) console.log("Error writing ");
        }
        else {
            if (this.debug) console.log("");
        }
    });
};

let onSteamLogOff = function onSteamLogOff(eresult) {
    console.log("Logged off from Steam.");
};

let onSteamError = function onSteamError(error) {
    console.log("Connection closed by server: " + error);
};

// steamFriends.on('relationships', function(steamID, relationship) {
//     if (relationship === steam.EFriendRelationship.RequestRecipient) {
//         steamUser.addFriend(steamID);
//         console.log("Got a friend request from " + steamID + ". Accepted.");
//     }
// });

steamUser.on('updateMachineAuth', function(sentry, callback) {
    let hashedSentry = crypto.createHash('sha1').update(sentry.bytes).digest();
    fs.writeFileSync(global.config.sentry, hashedSentry);
    console.log("sentryfile saved");
    callback({
        sha_file: hashedSentry
    });
});


// Login, only passing authCode if it exists
var logOnDetails = {
    "account_name": global.config.steam_user,
    "password": global.config.steam_pass,
};
if (global.config.steam_guard_code) logOnDetails.auth_code = global.config.steam_guard_code;
if (global.config.two_factor_code) logOnDetails.two_factor_code = global.config.two_factor_code;

try {
    var sentry = fs.readFileSync(global.config.sentry);
    if (sentry.length) logOnDetails.sha_sentryfile = sentry;
} catch (beef) {
    console.log("cannot load the sentry. " + beef);
}

// steamClient.connect();
steamClient.on('connected', function() {
    steamUser.logOn(logOnDetails);
});
steamClient.on('logOnResponse', onSteamLogOn);
steamClient.on('loggedOff', onSteamLogOff);
steamClient.on('error', onSteamError);
steamClient.on('servers', onSteamServers);

discordClient.login(config.discord_token);
