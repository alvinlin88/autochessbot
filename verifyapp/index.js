const express = require("express")
const app = express()
const rp = require("request-promise")
const querystring = require("querystring")
const UserAPI = require("../app/helpers/UserAPI")
const VerifiedSteamAPI = require("../app/helpers/VerifiedSteamAPI")

const cookieParser = require("cookie-parser")
const session = require("express-session")

app.use(cookieParser())
app.set("view engine", "pug")
app.set("views", __dirname + "/views")
app.use(
  session({ secret: "tony numba wan", resave: false, saveUninitialized: false })
)
app.use('/assets', express.static(__dirname + "/assets"))
app.use('/scripts', express.static(__dirname + "/scripts"))

const config = require("./config")
const CLIENT_ID = config.discord_client_id
const CLIENT_SECRET = config.discord_client_secret
const authorize_endpoint = "https://discordapp.com/api/oauth2/authorize"

const SteamID = require("steamid")

app.get("/", function(req, res) {
  let query =
    "?" +
    querystring.stringify({
      client_id: CLIENT_ID,
      redirect_uri: config.verify_redirect_url,
      scope: "connections identify",
      response_type: "code"
    })

  let redirect = authorize_endpoint + query

  res.redirect(redirect)
})

app.get("/confirm", function(req, res) {
  let steamID = req.query.steamID
  let data = req.session.data
  if (!data || !data.connections.map(user => user.steamid).includes(steamID)) {
    // The steamID is selected from the select page, this should never happen unless someone tries to access
    // this page directly.
    res.render("error")
    // todo: log attempt
  } else {
    VerifiedSteamAPI.findOneBySteam(steamID)
      .then(verifiedSteam => {
        if (verifiedSteam === null) {
          // The steam is not known to us
          User.upsertUserWithVerifiedSteam(data.id, steamID).then(() => res.render(
            "select_success",
            {
              avatar: data.avatar,
              username: data.username,
              tag: data.tag,
              steamID: steamID
            }
          ))
        } else {
          return UserAPI.findById(verifiedSteam.userId).then(user => {
            if (user.discord === data.id) {
              // The user has verified with this steam before, simply switch to it
              return user
                .update({
                  steam: verifiedSteam.steam,
                  validated: true
                })
                .then(() => res.render(
                  "select_success",
                  {
                    avatar: data.avatar,
                    username: data.username,
                    tag: data.tag,
                    steamID: steamID
                  }
                ))
            } else {
              // The steam was verified by another user.
              res.render("error", {
                message:
                  "The steam id was verified by another user. If you own the other discord account, post in #help-desk and a staff member can help you"
              })
            }
          })
        }
      })
      .catch(err => {
        // todo: needs logging
        res.render("error")
      })
  }
})

app.get("/select", function(req, res) {
  res.render("select", req.session.data)
})

// Discord api returns an "alternate" steamID64, this converts it to the correct one.
function convertSteamId(connection) {
  let steamID = new SteamID(connection.id)
  steamID.instance = SteamID.Instance.DESKTOP
  return steamID.getSteamID64()
}

// https://discordapp.com/developers/docs/reference#image-formatting
function getAvatarUrl(user_response) {
  if (user_response.avatar === null) {
    return `https://cdn.discordapp.com/embed/avatars/${user_response.discriminator %
      5}.png`
  }
  return `https://cdn.discordapp.com/avatars/${user_response.id}/${
    user_response.avatar
  }.png`
}

function getUserName(user_response) {
  return user_response.username
}

function getUserTag(user_response) {
  return "#" + user_response.discriminator
}

app.get("/callback", (req, res, err) => {
  let code = req.query.code

  // todo: I believe we don't need to obtain a new token every time (it does expire thou)
  rp({
    uri: "https://discordapp.com/api/oauth2/token",
    qs: {
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      redirect_uri: config.verify_redirect_url
    },
    method: "POST",
    json: true
  })
    .then(tokens => {
      let fetch_user = rp({
        uri: "http://discordapp.com/api/users/@me",
        method: "GET",
        json: true,
        headers: {
          Authorization: "Bearer " + tokens.access_token
        }
      })

      let fetch_connections = rp({
        uri: "http://discordapp.com/api/users/@me/connections",
        method: "GET",
        json: true,
        headers: {
          Authorization: "Bearer " + tokens.access_token
        }
      })
        .then(connections =>
          connections
            .filter(connection => connection.type === "steam")
            .map(convertSteamId)
        )
        .then(steamIDs => {
          if (steamIDs.length > 0) {
            return rp({
              uri:
                "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
              method: "GET",
              json: true,
              qs: {
                key: config.steam_token,
                username: getUserName(user_response),
                tag: getUserTag(user_response)
              }
            })
          } else {
            return null
          }
        })

      return Promise.all([fetch_user, fetch_connections])
    })
    .then(values => {
      let user_response = values[0]
      let steam_response = values[1]

      if (
        steam_response === null ||
        !steam_response.response.hasOwnProperty("players") ||
        steam_response.response.players.length === 0
      ) {
        res.render("no_steam", {
          avatar: getAvatarUrl(user_response),
          username: getUserName(user_response),
          tag: getUserTag(user_response)
        })
      } else {
        let data = {
          avatar: getAvatarUrl(user_response),
          username: getUserName(user_response),
          tag: getUserTag(user_response),
          id: user_response.id,
          connections: steam_response.response.players
        }

        req.session.data = data
        res.redirect("/select")
      }
    })
    .catch(err => {
      // need logging
      res.render("error")
    })
})

app.listen("8080", err => {
  if (err) {
    return console.log("err!", err)
  }

  console.log("server started")
})

// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500)
  res.render("select_error")
})
