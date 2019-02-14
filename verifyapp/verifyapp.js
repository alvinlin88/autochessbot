const express = require("express");
const app = express();
const rp = require("request-promise");
const querystring = require('querystring');

const cookieParser = require("cookie-parser");
app.use(cookieParser());
app.set('view engine', 'pug');
app.set('views', __dirname + '/views');

const config = require("./config");
const CLIENT_ID = config.discord_client_id;
const CLIENT_SECRET = config.discord_client_secret;
const authorize_endpoint = "https://discordapp.com/api/oauth2/authorize";

const SteamID = require('steamid');


app.get("/", function (req, res) {
    let query = '?' + querystring.stringify({
        client_id: CLIENT_ID,
        redirect_uri: config.verify_redirect_url,
        scope: "connections identify",
        response_type: "code"
    });

    let redirect = authorize_endpoint + query;

    res.redirect(redirect);
});

app.get("/confirm", function (req, res) {

    let steamID = req.query.steamID;
    let data = req.cookies.data;
    if (!data.steamConnections.map(user => user.steamID).includes(steamID)) {
        // The steamID is selected from the select page, this should never happen unless someone tries to access
        // this page directly.
        res.clearCookie("data", {httpOnly: true});
        res.render("select_error");
    }

    rp({
        uri: "http://localhost:8080/private/linksteam",
        method: "POST",
        json: true,
        headers: {
            "Authorization": "Bearer " + "SUPERSECRET1!", // just in case port leaks
        },
        body: {
            username: data.username,
            userID: data.userID,
            steamID: steamID,
        }
    }).then(() => {
        res.clearCookie("data", {httpOnly: true});
        res.render("select_success", {steamID: steamID});
    }).catch(err => {
        console.log(err.message); // need logging
        res.clearCookie("data", {httpOnly: true});
        res.render("select_error");
    });

});

app.get("/select", function (req, res) {
    res.render('select', {connections: req.cookies.data.steamConnections, username: req.cookies.data.username});
});

app.get("/callback", (req, res, err) => {
    let code = req.query.code;
    console.log(req.query.code);

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
        json: true,
    }).then(tokens => {
        let fetch_user = rp({
            uri: "http://discordapp.com/api/users/@me",
            method: "GET",
            json: true,
            headers: {
                "Authorization": "Bearer " + tokens.access_token,
            }
        });

        let fetch_connections = rp({
            uri: "http://discordapp.com/api/users/@me/connections",
            method: "GET",
            json: true,
            headers: {
                "Authorization": "Bearer " + tokens.access_token,
            }
        });

        Promise.all([fetch_user, fetch_connections]).then(
            values => {
                let user_response = values[0];
                let connections_response = values[1];
                let steamConnections = [];
                connections_response.forEach(item => {
                    if (item.type === "steam") {
                        let steamID = new SteamID(item.id);
                        steamID.instance = SteamID.Instance.DESKTOP;
                        steamConnections.push({
                            profile_name: item.name,
                            steamID: steamID.getSteamID64()
                        });
                    }
                });

                if (steamConnections.length === 0) {
                    res.render('no_steam');
                }

                let data = {
                    username: user_response.username,
                    userID: user_response.id,
                    steamConnections: steamConnections,
                };

                res.cookie("data", data);
                res.redirect("/select");
            }
        )
    }).catch(err => {
        // need logging
        res.sendStatus(500);
    });
});

app.listen("80", (err) => {
    if (err) {
        return console.log("err!", err)
    }

    console.log("server started");
});

