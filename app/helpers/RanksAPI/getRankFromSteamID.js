const client = require("../client")
const request = require("request")
const logger = require("../logger")
const MessagesAPI = require("../MessagesAPI")

let DACSwitch = 1
// TODO: Circuit breaker
let lastDACASuccess = Date.now()
let lastDACBSuccess = Date.now()

const getRankFromSteamIDA = (steamId) => {
  return new Promise(function(resolve, reject) {
    request(
      "http://autochess.ppbizon.com/ranking/get?player_ids=" + steamId,
      {
        json: true,
        headers: {
          "User-Agent": "Valve/Steam HTTP Client 1.0 (570;Windows;tenfoot)"
        }
      },
      (err, res, body) => {
        if (err) {
          resolve(null)
          logger.error(err)
        }

        if (res !== undefined && res.hasOwnProperty("statusCode")) {
          if (res.statusCode === 200 && body.err === 0) {
            try {
              // logger.info("Got result from server: " + JSON.stringify(body.user_info));
              lastDACASuccess = Date.now()
              if (body.ranking_info.length === 1) {
                resolve({
                  mmr_level: body.ranking_info[0]["mmr_level"],
                  score: body.ranking_info[0]["score"]
                })
              } else {
                resolve(null)
              }
            } catch (error) {
              logger.error(error.message + " " + error.stack)
            }
          } else {
            // use other endpoint without score
            getRankFromSteamIDB(steamId).then(promise => {
              resolve(promise)
            })
          }
        } else {
          resolve(null)
        }
      }
    )
  })
}

const getRankFromSteamIDB = (steamId) => {
  return new Promise(function(resolve, reject) {
    request(
      "http://autochess.ppbizon.com/courier/get/@" + steamId,
      { json: true },
      (err, res, body) => {
        if (err) {
          resolve(null)
          logger.error(err)
        }

        if (res !== undefined && res.hasOwnProperty("statusCode")) {
          if (res.statusCode === 200 && body.err === 0) {
            try {
              // logger.info("Got result from server: " + JSON.stringify(body.user_info));
              if (body.user_info.hasOwnProperty(steamId)) {
                lastDACBSuccess = Date.now()
                resolve({
                  mmr_level: body.user_info[steamId]["mmr_level"],
                  score: null
                })
              } else {
                resolve(null)
              }
            } catch (error) {
              logger.error(error.message + " " + error.stack)
            }
          } else {
            resolve(null)
          }
        } else {
          resolve(null)
        }
      }
    )
  })
}

const getRankFromSteamID = (steamId) => {
  return new Promise(function(resolve, reject) {
    if (DACSwitch === 1) {
      getRankFromSteamIDA(steamId).then(result => {
        resolve(result)
      })
    } else if (DACSwitch === 2) {
      getRankFromSteamIDB(steamId).then(result => {
        resolve(result)
      })
    } else {
      logger.error("Error getting any results from DAC Servers! :(")
      MessagesAPI.sendToChannelWithMention(
        client.channels.find(r => r.name === "chessbot-warnings").id,
        "Error getting any results from DAC Servers! :("
      )
      resolve(null)
    }
  })
}

module.exports = getRankFromSteamID
