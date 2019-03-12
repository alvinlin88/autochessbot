let config = {};

config.steam_name = "ChessBotTest";
config.steam_user = "";
config.steam_pass = "";
config.steam_guard_code = "";

config.discord_tokens = [""];
config.steam_token = "";

config.discord_client_id = ""; // Only need to set the first bot's id/secret
config.discord_client_secret = "";
config.verify_redirect_url = "http://localhost:8080/callback";

config.server_ids = [];

config.channels = { // for i18n
    "chessbot-commands": "chessbot-commands",
    "chessbot-warnings": "chessbot-warnings",
    "chessbot-help": "chessbot-help",
    "readme": "readme",
    "staff-bot": "staff-bot",
    "help-desk": "help-desk",
};

config.logfile = "autochess.log";
config.logfile_error = "autochess_error.log";
config.sqlitedb = "db.sqlite";
config.sentry = "sentry";

// Interval to save a backup of lobbies
config.lobbies_backup_cron = "*/5 * * * * *"; // Every five seconds
config.lobbies_file = "lobbies-data.json";

// Max message length before flushing
config.messageMaxLength = 2000;
// Interval to flush bot messages
config.message_flush_cron = "* * * * * *"; // Every second

// Admin role
// TODO: Make this a list
config.adminRoleName = "Staff";
config.leagueRoles = ["Tester", "Beginner", "Intermediate", "Advanced", "Expert", "Master", "King", "Queen"];
config.exemptLeagueRolePruning = [];

config.leagueToLobbiesPrefix = {
    "Beginner": "beginner-lobbies",
    "Intermediate": "intermediate-lobbies",
    "Advanced": "advanced-lobbies",
    "Expert": "expert-lobbies",
    "Master": "master-lobbies",
    "King": "king-lobbies",
    "Queen": "queen-lobbies"
};

config.leagueRequirements = {
    "Beginner": 1,
    "Intermediate": 19,
    "Advanced": 24,
    "Expert": 28,
    "Master": 31,
};

// These roles must exist on the server
// TODO: Create these roles if they don't exist
config.validRegions = ["NAW", "NAE", "EUW", "EUE", "RU", "SEA", "OCE", "SA"];
// Channels to allow bot commands in if you're not an admin
config.botChannels = ["development", "chessbot-commands"];

module.exports = config;
