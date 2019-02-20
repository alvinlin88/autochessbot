const client = require("./helpers/client")
const config = require("./config")
const logger = require("./helpers/logger")
const express = require("express")
const bodyParser = require("body-parser")
const app = express()
app.use(bodyParser.json())
const handleMessage = require("./handleMessage")

// function submitTournamentSignup(
//   message,
//   discord,
//   discordname,
//   steam,
//   steamname,
//   rank,
//   mmr,
//   datetime
// ) {
//   return new Promise(function(resolve, reject) {
//     let data = qs.stringify({
//       discord: discord,
//       discordname: discordname,
//       steam: steam,
//       steamname: steamname,
//       rank: rank,
//       mmr: mmr,
//       datetime: datetime
//     })
//     request(
//       "https://script.google.com/macros/s/AKfycbxa3sVhst5AaKfdsDXYuTei71oa9HBkNlOwtOP3Ge9e7cuRYW3M/exec",
//       {
//         method: "POST",
//         followAllRedirects: true,
//         json: true,
//         headers: {
//           "Content-Length": data.length,
//           "Content-Type": "application/x-www-form-urlencoded"
//         },
//         body: data
//       },
//       (err, res, body) => {
//         if (err) {
//           reject(err)
//         }
//         if (res.statusCode === 200) {
//           resolve()
//         }
//       }
//     )
//   })
// }

client.on("ready", () => {
  logger.info(`Logged in as ${client.user.tag}!`)
  try {
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
