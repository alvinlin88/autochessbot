const client = require("./helpers/client")
const config = require("../config")
const logger = require("./helpers/logger")
const express = require("express")
const bodyParser = require("body-parser")
const app = express()
app.use(bodyParser.json())
const mc = require("./helpers/MessageConsolidator")
const LobbiesAPI = require("./helpers/LobbiesAPI")
const RolesAPI = require("./helpers/RolesAPI")
const handleMessage = require("./handleMessage")

mc.start()
LobbiesAPI.restoreLobbies()
LobbiesAPI.startBackupJob()

client.on("ready", () => {
  logger.info(`Logged in as ${client.user.tag}!`)
  try {
    RolesAPI.setupRoles(
      client.guilds.find(g => g.id === config.server_id).roles
    )
    client.channels
      .get(client.channels.find(r => r.name === "staff-bot").id)
      .send("I am back!")
      .then(logger.info)
      .catch(logger.error)
  } catch (err) {
    logger.error(err)
  }
})

client.on("error", logger.error)

client.on("message", handleMessage)

client.login(config.discord_token)
