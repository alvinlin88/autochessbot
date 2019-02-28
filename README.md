How to run locally
==================
## BOT APP

- Create a Discord Server
- Set up Discord Application: https://discordapp.com/developers/applications/
- Grab Client ID: Example `538445434251000000`
- Create a bot `https://discordapp.com/developers/applications/<client_id>/bots`
- Make the bot join your server: `https://discordapp.com/oauth2/authorize?client_id=<client_id>&scope=bot`
- Grab bot token `https://discordapp.com/developers/applications/<client_id>/bots`
- Put bot token in `config.js` `config.discord_token`
- Start server: nodejs app.js (Node v10.15.1)
- Make sure you have region roles and lobbies created on your discord according to your config.js file

Set up your server with the proper channels and roles (or else the bot will throw errors when it tries to grab channel ID's by name.)

## VERIFY APP

- Similar to the bot app set up, you'll need to configure the following:
  - `discord_client_id`
  - `discord_client_secret`
  - `steam_token` which is the steam api key, get one at `https://steamcommunity.com/dev/apikey`
- Check the port for verifyapp. Normally it's `8080`
- Change `config.verify_redirect_url` to `http://localhost:<port>/callback`
- Go to your the discord oauth page `https://discordapp.com/developers/applications/<client_id>/oauth` and add `http://localhost:<port>/callback` to `Redirects`
- Start server: `node verifyapp.js` and test verification at `http://localhost:<port>`

Let's Encrypt
=============
```
sudo wget -r --no-parent -A 'epel-release-*.rpm' http://dl.fedoraproject.org/pub/epel/7/x86_64/Packages/e/
sudo rpm -Uvh dl.fedoraproject.org/pub/epel/7/x86_64/Packages/e/epel-release-*.rpm
sudo yum-config-manager --enable epel*
sudo yum repolist all
sudo yum install -y certbot python2-certbot-nginx
sudo certbot
```
Follow instructions to generate a certificate for the subdomain. Have certbot install the cert or you can install it yourself.
Use proxy pass for `location /` for example:
```
location / {
    proxy_set_header        Host $host;
    proxy_set_header        X-Real-IP $remote_addr;
    proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header        X-Forwarded-Proto $scheme;

    proxy_pass              http://localhost:8080;
    proxy_read_timeout      90;

    proxy_redirect          http://localhost:8080 https://autochessbot.vinthian.com;
}
```
