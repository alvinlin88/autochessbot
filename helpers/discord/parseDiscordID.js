const parseDiscordID = discordStr => {
  if (discordStr.substring(1, 2) === "@") {
    let result = discordStr.substring(2, discordStr.length - 1)

    if (result[0] === "!") {
      result = result.substring(1)
    }

    return result
  } else {
    return null
  }
}

module.exports = parseDiscordID
