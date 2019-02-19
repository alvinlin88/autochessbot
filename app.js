const client = require("./helpers/client")
const config = require("./config")
const logger = require("./helpers/logger")

const express = require("express")
const bodyParser = require("body-parser")
const app = express()
app.use(bodyParser.json())

const request = require("request")
const User = require("./schema/user.js")

const handleMessage = require("./handleMessage")
const MessagingAPI = require("./helpers/MessagingAPI")

app.post("/private/linksteam", (req, res, err) => {
  if (req.header("Authorization") !== "Bearer SUPERSECRET1!") {
    logger.error("Unauthorized access on /private/linksteam!!!") // port is leaking
    res.sendStatus(401)
  } else {
    let channel = client.channels.find(r => r.name === "staff-bot")

    let userDiscordId = req.body.userID
    let userSteamId = req.body.steamID

    let usersPromise = User.findAllBySteam(userSteamId).then(users => {
      let usersWithMatchingSteam = {
        verifier: null, // The verifier, who had linked his discord to the steam id before verification system is in place.
        nonVerifier: [] // List of discord users who aren't the verifier but had linked to the same steam.
      }
      users.forEach(user => {
        if (user.discord === userDiscordId) {
          usersWithMatchingSteam.verifier = user
        } else {
          usersWithMatchingSteam.nonVerifier.push(user)
        }
      })
      return new Promise((resolve, reject) => resolve(usersWithMatchingSteam))
    })

    usersPromise
      .then(usersWithMatchingSteam => {
        // todo Is there a way to do upsert so we can get rid of if/else?
        let upsertUserPromise
        if (usersWithMatchingSteam.verifier === null) {
          // The verifier did not link or is new to the qihl.
          upsertUserPromise = User.findByDiscord(userDiscordId).then(user => {
            if (user === null) {
              return User.create({
                discord: userDiscordId,
                steam: userSteamId,
                validated: true
              })
            } else {
              return user.update({ steam: userSteamId, validated: true })
            }
          })
        } else {
          upsertUserPromise = usersWithMatchingSteam.verifier.update({
            validated: true
          })
        }
        return upsertUserPromise
      })
      .then(() => {
        MessagingAPI.sendDM(userDiscordId, "Your steam account has now been verified.")
        // At this point we can be sure the user verification is complete. Overwrite can be performed async.
        res.sendStatus(200)
      })
      .catch(err => {
        res.sendStatus(500)
        logger.error(err)
      })

    usersPromise
      .then(usersWithMatchingSteam =>
        Promise.all(
          usersWithMatchingSteam.nonVerifier.map(user =>
            user.update({ steam: null, validated: false })
          )
        )
      )
      .then(users => {
        //todo: update roles to demote these people;
        if (users.length > 0) {
          let discordIds = users
            .map(user => "<@" + user.discord + ">")
            .join(",")
          channel.send(
            `The following discord ids: ${discordIds} were linked to steam id ${userSteamId} that is now verified by <@${userDiscordId}>`
          )
        }
      })
      .catch(logger.error)
  }
})

app.listen("8080", err => {
  if (err) {
    return console.log("err!", err)
  }

  console.log("private validation server started")
})

// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500)
  res.render("select_error")
})

const qs = require("querystring")

function submitTournamentSignup(
  message,
  discord,
  discordname,
  steam,
  steamname,
  rank,
  mmr,
  datetime
) {
  return new Promise(function(resolve, reject) {
    let data = qs.stringify({
      discord: discord,
      discordname: discordname,
      steam: steam,
      steamname: steamname,
      rank: rank,
      mmr: mmr,
      datetime: datetime
    })
    request(
      "https://script.google.com/macros/s/AKfycbxa3sVhst5AaKfdsDXYuTei71oa9HBkNlOwtOP3Ge9e7cuRYW3M/exec",
      {
        method: "POST",
        followAllRedirects: true,
        json: true,
        headers: {
          "Content-Length": data.length,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: data
      },
      (err, res, body) => {
        if (err) {
          reject(err)
        }
        if (res.statusCode === 200) {
          resolve()
        }
      }
    )
  })
}

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
