const commandList = require("./commandList")

const getCommand = name => {
  if (!commandList[name]) return () => {}
  return commandList[name]
}

module.exports = getCommand