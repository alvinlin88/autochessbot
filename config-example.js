var config = {};

config.steam_name = "ChessBotTest";
config.steam_user = "";
config.steam_pass = "";
config.steam_guard_code = "";
config.discord_token = "";
config.steam_token = "";
config.discord_client_id = "";
config.discord_client_secret = "";
config.verify_redirect_url = "";

config.logfile = "autochess.log";
config.logfile_error = "autochess_error.log";
config.sqlitedb = "db.sqlite";
config.sentry = "sentry";
config.lobbies_file = "lobbies-data.json";
config.lobbies_backup_cron = "*/5 * * * * *"; // Every five seconds.

config.adminRoleName = "Staff";
config.leagueRoles = ["Tester", "Beginner", "Intermediate", "Advanced", "Expert", "Master"];
config.exemptLeagueRolePruning = [];
config.leagueToLobbiesPrefix = {"Tester": "tester-lobbies", "Beginner": "beginner-lobbies", "Intermediate": "intermediate-lobbies", "Advanced": "advanced-lobbies", "Expert": "expert-lobbies", "Master": "master-lobbies"};
config.lobbiesToLeague = {"tester-lobbies": "Tester", "beginner-lobbies": "Beginner", "intermediate-lobbies": "Intermediate", "advanced-lobbies": "Advanced", "expert-lobbies": "Expert", "master-lobbies": "Master"}; // TODO: refactor.. being lazy
config.leagueRequirements = {"Beginner": 1, "Intermediate": 19, "Advanced": 24, "Expert": 28, "Master": 31, "Tester": 999};
config.leagueChannels = {"beginner-lobbies": "<#542420779493490692>", "intermediate-lobbies-na": "<#543096210999869440>", "intermediate-lobbies-eu": "<#543096484091133953>", "intermediate-lobbies-sea": "<#543097896812150794>", "intermediate-lobbies-oce": "<#543097855972474891>", "intermediate-lobbies-sa": "<#543097809717428254>", "intermediate-lobbies-ru": "<#543167378792644666>", "intermediate-lobbies": "<#539360159554863114>", "advanced-lobbies": "<#539572170251173898>", "expert-lobbies": "<#542533721773965312>", "master-lobbies": "<#542927566479163420>"};
config.validRegions = ["NAW", "NAE", "EUW", "EUE", "RU", "SEA", "OCE", "SA"];
//config.regionTags = {"NA": "<@&539339934327111680>", "EU": "<@&539339927931060225>", "EUE": "<@&543487257001328658>", "EUW": "<@&539339927931060225>", "RU": "<@&543166887568343082>", "SEA": "<@&539339931357544448>", "OCE": "<@&540223287742169089>", "SA": "<@&539339925229928450>"};
config.botChannels = ["development", "chessbot-commands"];

module.exports = config;
