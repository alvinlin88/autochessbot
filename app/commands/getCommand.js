const commandList = require("./commandList")

const getCommand = name => {
  if (!commandList[name]) return null
  return commandList[name]
}

module.exports = getCommand
