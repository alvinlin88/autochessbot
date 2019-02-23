var config = {}

config.server_id = ""
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

config.leagueRoles = [
  "Tester",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
  "Master",
  "King",
  "Queen"
]
config.exemptLeagueRolePruning = []
config.leagueToLobbiesPrefix = {
  Tester: "tester-lobbies",
  Beginner: "beginner-lobbies",
  Intermediate: "intermediate-lobbies",
  Advanced: "advanced-lobbies",
  Expert: "expert-lobbies",
  Master: "master-lobbies",
  King: "king-circlejerk",
  Queen: "queen-circlejerk"
}
config.leagueRequirements = {
  Beginner: 1,
  Intermediate: 19,
  Advanced: 24,
  Expert: 28,
  Master: 31,
  Tester: 999
}
config.validRegions = ["NAW", "NAE", "EUW", "EUE", "RU", "SEA", "OCE", "SA"]
config.botChannels = ["development", "chessbot-commands"]

config.messageMaxLength = 2000

module.exports = config
