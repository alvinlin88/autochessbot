const getRankData = require("./getRankData")

const getRankString = rank => {
  let rankData = getRankData(rank)
  let iconStr = ""
  if (rankData.hasOwnProperty("icon")) {
    iconStr = rankData.icon + " "
  }
  if (rankData.hasOwnProperty("icon") && rankData.hasOwnProperty("name")) {
    if (rankData.hasOwnProperty("level")) {
      return iconStr + "**" + rankData.name + "-" + rankData.level + "**"
    } else {
      return iconStr + "**" + rankData.name + "**"
    }
  }
  return "ERROR"
}

module.exports = getRankString
