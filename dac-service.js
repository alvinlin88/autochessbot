const logger = require('./logger.js');
const request = require("request");

const metrics = require("./metrics");

class DacService {
    constructor() {
        this.DACSwitch = 2;
        // TODO: Circuit breaker
        this.lastDACASuccess = Date.now();
        this.lastDACBSuccess = Date.now();
    }

    getRankFromSteamId(steamId) {
        switch (this.DACSwitch) {
            case 1:
                return this.getRankFromSteamIdA(steamId);
            case 2:
                return this.getRankFromSteamIdB(steamId);
            default:
                logger.error("Error getting any results from DAC Servers! :(");
                return Promise.resolve(null);
        }
    }

    getRankFromSteamIdB(steamId) {
        return new Promise(function (resolve, reject) {
            const end = metrics.dacRequestHistogram.startTimer();
            request('http://autochess.ppbizon.com/courier/get/@' + steamId, {json: true}, (err, res, body) => {
                end();

                if (err) {
                    resolve(null);
                    logger.error(err);
                }
                if (res !== undefined && res.hasOwnProperty("statusCode")) {
                    if (res.statusCode === 200 && body.err === 0) {
                        try {
                            if (body.user_info.hasOwnProperty(steamId)) {
                                this.lastDACBSuccess = Date.now();
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
        }.bind(this));
    }

    getRankFromSteamIdA(steamId) {
        return new Promise(function (resolve, reject) {
            const end = metrics.dacRequestHistogram.startTimer();
            request('http://autochess.ppbizon.com/ranking/get?player_ids=' + steamId, {
                json: true,
                headers: {'User-Agent': 'Valve/Steam HTTP Client 1.0 (570;Windows;tenfoot)'}
            }, (err, res, body) => {
                end();

                if (err) {
                    resolve(null);
                    logger.error(err);
                }

                if (res !== undefined && res.hasOwnProperty("statusCode")) {
                    if (res.statusCode === 200 && body.err === 0) {
                        try {
                            this.lastDACASuccess = Date.now();
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
                        this.getRankFromSteamIdB(steamId).then(promise => {
                            resolve(promise);
                        });
                    }
                } else {
                    resolve(null);
                }
            });
        }.bind(this));
    }

    getRanksFromSteamIdList(steamIdList) {
        return new Promise(function (resolve, reject) {
            request('http://101.200.189.65:431/dac/ranking/get?player_ids=' + steamIdList.join(',') + '&hehe=' + Math.floor(Math.random() * 10000), {
                json: true,
                headers: {'User-Agent': 'Valve/Steam HTTP Client 1.0 (570;Windows;tenfoot)'}
            }, (err, res, body) => {
                if (err) {
                    reject(err);
                }

                if (res !== undefined && res.hasOwnProperty("statusCode")) {
                    if (res.statusCode === 200) {
                        try {
                            resolve(body.ranking_info);
                        } catch (error) {
                            logger.error(error.message + " " + error.stack);
                        }
                    }
                }
            });
        }.bind(this));
    }
}

const dacService = new DacService();
module.exports = dacService;