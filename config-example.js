var config = {}

config.steam_name = "ChessBotTest"
config.steam_user = ""
config.steam_pass = ""
config.steam_guard_code = ""
config.discord_token = ""
config.steam_token = ""
config.discord_client_id = ""
config.discord_client_secret = ""
config.verify_redirect_url = ""

config.logfile = "autochess.log"
config.logfile_error = "autochess_error.log"
config.sqlitedb = "db.sqlite"
config.sentry = "sentry"
config.lobbies_file = "lobbies-data.json"
config.lobbies_backup_cron = "*/5 * * * * *" // Every five seconds.
config.message_flush_cron = "* * * * * *" // Every second.

config.adminRoleName = "Staff"

config.messageMaxLength = 2000

module.exports = config
