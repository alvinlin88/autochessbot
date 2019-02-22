const request = require("request")
const logger = require("../logger")
const { steam_token } = require("../../../config")

const getSteamPersonaNames = steamIds => {
  return new Promise(function(resolve, reject) {
    request(
      "http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=" +
        steam_token +
        "&steamids=" +
        steamIds.join(","),
      { json: true },
      (err, res, body) => {
        if (err) {
          reject(err)
        }

        if (res !== undefined && res.hasOwnProperty("statusCode")) {
          if (res.statusCode === 200) {
            try {
              // logger.info("Got result from server: " + JSON.stringify(body.response));

              let personaNames = {}

              steamIds.forEach(steamId => {
                personaNames[steamId] = "ERROR"
              })

              for (let playerKey in body.response.players) {
                if (body.response.players.hasOwnProperty(playerKey)) {
                  let player = body.response.players[playerKey]

                  personaNames[player["steamid"]] = player[
                    "personaname"
                  ].replace(/`/g, "")
                }
              }

              resolve(personaNames)
            } catch (error) {
              logger.error(error.message + " " + error.stack)
            }
          }
        }
      }
    )
  })
}

module.exports = getSteamPersonaNames
