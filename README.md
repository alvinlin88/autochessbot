How to run locally
==================

- Create a Discord Server
- Set up Discord Application: https://discordapp.com/developers/applications/
- Grab Client ID: Example `538445434251000000`
- Create a bot `https://discordapp.com/developers/applications/<client_id>/bots`
- Make the bot join your server: `https://discordapp.com/oauth2/authorize?client_id=<client_id>&scope=bot`
- Grab bot token `https://discordapp.com/developers/applications/<client_id>/bots`
- Put bot token in `config.js` `config.discord_token`
- Start server: nodejs app.js (Node v10.15.1)