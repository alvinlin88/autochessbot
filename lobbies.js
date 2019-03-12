"use strict";

const fs = require('fs');
const config = require("./config");
const CronJob = require('cron').CronJob;
const logger = require('./logger.js');

module.exports = class Lobbies {
    constructor() {
        this.lobbies = {};
        this.backupJob = new CronJob(config.lobbies_backup_cron, function() {
            this.backupLobbies();
        }.bind(this), null, /* don't start right after init */ false, 'America/Los_Angeles');
    }

    initialize() {
        Object.keys(config.server_config).forEach(serverID => {
            this.lobbies[serverID] = {};
            config.leagueRoles.forEach(leagueRole => {
                this.lobbies[serverID][config.leagueToLobbiesPrefix[leagueRole]] = {};
                config.validRegions.forEach(leagueRegion => {
                    this.lobbies[serverID][config.leagueToLobbiesPrefix[leagueRole] + "-" + leagueRegion.toUpperCase()] = {};
                });
            });
        });
    }

    getLobbiesInChannel(serverID, leagueChannel) {
        return this.lobbies[serverID][leagueChannel];
    }

    // This version is guarded with existence check
    getLobbyForHostSafe(serverID, leagueChannel, hostUserSteam) {
        let result = null;
        for (let hostId in this.lobbies[serverID][leagueChannel]) {
            if (this.lobbies[serverID][leagueChannel].hasOwnProperty(hostId)) {
                let lobby = this.lobbies[serverID][leagueChannel][hostId];

                if (lobby["host"] === hostUserSteam) {
                    result = lobby;
                }
            }
        }
        return result;
    }

    hasHostedLobbyInChannel(serverID, leagueChannel, hostUserSteam) {
        return this.lobbies[serverID][leagueChannel].hasOwnProperty(hostUserSteam);
    }

    // isn't this always the case?
    isHostOfHostedLobby(serverID, leagueChannel, hostUserSteam) {
        return this.lobbies[serverID][leagueChannel][hostUserSteam]["host"] === hostUserSteam;
    }

    getLobbyForHost(serverID, leagueChannel, hostUserSteam) {
        return this.lobbies[serverID][leagueChannel][hostUserSteam];
    }

    getLobbyForPlayer(serverID, leagueChannel, player) {
        let result = null;
        for (let hostId in this.lobbies[serverID][leagueChannel]) {
            if (this.lobbies[serverID][leagueChannel].hasOwnProperty(hostId)) {
                let lobby = this.lobbies[serverID][leagueChannel][hostId];

                lobby["players"].forEach(p => {
                    if (p === player) {
                        result = lobby;
                    }
                });
            }
        }
        return result;
    }

    backupLobbies() {
        this.overwriteBackupFile(JSON.stringify(this.lobbies));
    }

    restoreLobbies() {
        try {
            let lobbiesData = fs.readFileSync(config.lobbies_file, 'utf8');
            this.lobbies = JSON.parse(lobbiesData);
        } catch (e) {
            this.overwriteBackupFile("");
            this.initialize();
        }
    }

    // does not write an empty backup file if read fails
    restoreLobbiesSafe() {
        let lobbiesData = fs.readFileSync(config.lobbies_file, 'utf8');
        this.lobbies = JSON.parse(lobbiesData);
    }

    overwriteBackupFile(content) {
        fs.writeFileSync(config.lobbies_file, content, (err) => {
            if (err) {
                logger.error(err)
            }
        });
    }

    deleteLobby(serverID, leagueChannel, hostUserSteam) {
        delete this.lobbies[serverID][leagueChannel][hostUserSteam];
    }

    // returns true if the player was in the lobby and now removed, false otherwise.
    removePlayerFromLobby(serverID, leagueChannel, hostUserSteam, playerUserSteam) {
        let lobby = this.lobbies[serverID][leagueChannel][hostUserSteam];
        let index = lobby.players.indexOf(playerUserSteam);
        if (lobby.hasOwnProperty("leaves")) {
            lobby.leaves = lobby.leaves + 1;
        }

        if (index > -1) {
            lobby.players.splice(index, 1);
            lobby.lastactivity = Date.now();
            return true;
        }
        return false;
    }

    createLobby(serverID, leagueChannel, hostUserSteam, region, rankRequirement, token) {
        let newLobby = {
            "host": hostUserSteam,
            "password": region.toLowerCase() + "_" + token.toLowerCase(),
            "players": [hostUserSteam],
            "region": region,
            "rankRequirement": rankRequirement,
            "starttime": Date.now(),
            "lastactivity": Date.now(),
            "leaves": 0,
        };
        this.lobbies[serverID][leagueChannel][hostUserSteam] = newLobby;
        return newLobby;
    }

    resetLobbies(serverID, leagueChannel) {
        this.lobbies[serverID][leagueChannel] = {};
    }

    removeLobbies(serverID, leagueChannel) {
        delete this.lobbies[serverID][leagueChannel];
    }

    startBackupJob() {
        this.backupJob.start();
    }
};
