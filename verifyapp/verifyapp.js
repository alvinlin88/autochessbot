const express = require("express");
const app = express();
const rp = require("request-promise");

const cookieParser = require("cookie-parser");
app.use(cookieParser());

const config = require("./config");
const CLIENT_ID = config.discord_client_id;
const CLIENT_SECRET = config.discord_client_secret;
const redirect = "https://discordapp.com/api/oauth2/authorize?client_id=" + CLIENT_ID + "&redirect_uri=http%3A%2F%2Flocalhost%3A80%2Fcallback&response_type=code&scope=connections%20identify";


app.get("/", function (request, response) {
    response.write("<!DOCTYPE html>");
    response.write("<a href=\"" + redirect + "\">Verify</a>");
    response.send();
});

app.get("/confirm", function (req, res) {

    rp({
        uri: "http://localhost:8080/private/linksteam",
        method: "POST",
        json: true,
        headers: {
            "Authorization": "Bearer " + "SUPERSECRET1!", // just in case port leaks
        },
        body: req.cookies.data
    }).then(() => {
        res.clearCookie("data", {httpOnly: true});
        res.sendStatus(200);
    }).catch(err => {
        console.log(err.message);
        res.clearCookie("data", {httpOnly: true});
        res.sendStatus(500);
    });

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
                let steamIDs = [];
                connections_response.forEach(item => {
                    if (item.type === "steam") {
                        steamIDs.push(item.id);
                    }
                });

                let data = {
                    "username": user_response.username,
                    "userID": user_response.id,
                    "steamIDs": steamIDs,
                };

                res.cookie("data", data);
                res.redirect("/confirm");
            }
        )
    }).catch(err => {
        res.sendStatus(500);
    });
});

app.listen("80", (err) => {
    if (err) {
        return console.log("err!", err)
    }

    console.log("server started");
});

