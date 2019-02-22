const axios = require("axios")
const logger = require("../logger")

let DACSwitch = 2
let lastDACASuccess = Date.now()
let lastDACBSuccess = Date.now()

const checkLastSuccess = () => {
  if (
    Date.now() - lastDACASuccess / 1000 > 180 &&
    Date.now() - lastDACBSuccess / 1000 > 180
  ) {
    DACSwitch = 3
  }
}

const getRankFromSteamIdA = async steamId => {
  try {
    const data = await axios({
      url: "http://autochess.ppbizon.com/ranking/get?player_ids=" + steamId,
      method: "get",
      headers: {
        "User-Agent": "Valve/Steam HTTP Client 1.0 (570;Windows;tenfoot)"
      }
    }).then(async res => {
      if (res.status !== 200)
        throw new Error("Cannot get rank with getRankFromSteamIdA")

      return res.data
    })

    lastDACASuccess = Date.now()

    if (data.ranking_info.length === 1) {
      return {
        mmr_level: data.ranking_info[0]["mmr_level"],
        score: data.ranking_info[0]["score"]
      }
    }
  } catch (err) {
    logger.error(err)
    DACSwitch = 2
  }

  checkLastSuccess()
  return null
}

const getRankFromSteamIdB = async steamId => {
  try {
    const data = await axios({
      url: "http://autochess.ppbizon.com/courier/get/@" + steamId,
      method: "get"
    }).then(async res => {
      if (res.status !== 200)
        throw new Error("Cannot get rank with getRankFromSteamIdB")

      return res.data
    })

    lastDACBSuccess = Date.now()

    if (data.user_info.hasOwnProperty(steamId)) {
      return {
        mmr_level: data.user_info[steamId]["mmr_level"],
        score: null
      }
    }
  } catch (err) {
    logger.error(err)
    DACSwitch = 1
  }

  checkLastSuccess()
  return null
}

const getRankFromSteamID = async steamId => {
  switch (DACSwitch) {
    case 1:
      return await getRankFromSteamIdA(steamId)
    case 2:
      return await getRankFromSteamIdB(steamId)
    default:
      logger.error("Error getting any results from DAC Servers! :(")
      return null
  }
}

module.exports = getRankFromSteamID
