const express = require("express");
const app = express();
const request = require("request");


const config = require("../config");
const CLIENT_ID = config.discord_client_id;
const CLIENT_SECRET = config.discord_client_secret;
const redirect = "https://discordapp.com/api/oauth2/authorize?client_id=" + CLIENT_ID + "&redirect_uri=http%3A%2F%2Fautochessbot.vinthian.com%2Fcallback&response_type=code&scope=connections%20identify";

app.get("/", function(request, response) {
    response.write("<!DOCTYPE html>");
    response.write("<a href=\"" + redirect + "\">Verify</a>");
    response.send();
});

app.get("/callback", (req, res, err) => {
    let code = req.query.code;
    console.log(req.query.code);

    function requestPromise(options) {
        return new Promise((resolve, reject) => {
            request(options, (err, response, body) => {
                if (err) {
                    console.error(err.message);
                    reject(err.message)
                }

                if (res === undefined) {
                    console.error(err.message);
                    reject(err.message);
                }

                try {
                    console.log(body);
                    resolve(body);
                } catch (error) {
                    console.error(error.message);
                    reject(error.message);
                }
            });
        });
    }

    (async function() {
        let tokens = await requestPromise({
            uri: "https://discordapp.com/api/oauth2/token?grant_type=authorization_code&code=" + code + "&redirect_uri=http%3A%2F%2Fautochessbot.vinthian.com%2Fcallback&client_id=" + CLIENT_ID + "&client_secret=" + CLIENT_SECRET,
            method: "POST",
            json: true,
        });
        console.log(tokens);

        let user_response = await requestPromise({
            uri: "http://discordapp.com/api/users/@me",
            method: "GET",
            json: true,
            headers: {
                "Authorization": "Bearer " + tokens.access_token,
            }
        });
        console.log(user_response);

        let connections_response = await requestPromise({
            uri: "http://discordapp.com/api/users/@me/connections",
            method: "GET",
            json: true,
            headers: {
                "Authorization": "Bearer " + tokens.access_token,
            }
        });
        console.log(connections_response);

        let validatesteam = await requestPromise({
            uri: "http://localhost:8080/private/linksteam",
            method: "POST",
            json: true,
            headers: {
                "Authorization": "Bearer " + "SUPERSECRET1!", // just in case port leaks
            },
            body: JSON.stringify({
                "user": user_response,
                "connections": connections_response
            }),
        });
        res.send();
    })();
});

app.listen("80", (err) => {
    if (err) {
        return console.log("err!", err)
    }

    console.log("server started");
});
