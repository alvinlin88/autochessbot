var config = {};

config.steam_name = "ChessBotTest";
config.steam_user = "";
config.steam_pass = "";
config.steam_guard_code = "";
config.discord_token = "NTQyNTE4MTIyNjE2MzI0MDk2.DzvK5A.ovBp2FTh611DLgEcnZXrzwWRkTQ";
config.steam_token = "7E1C597565FD8BC68346696D070CBD58";

config.logfile = "autochess.log";
config.logfile_error = "autochess_error.log";
config.sqlitedb = "db.sqlite";
config.sentry = "sentry";
config.lobbies_file = "lobbies";

config.adminRoleName = "Staff";
config.leagueRoles = ["Beginner", "Intermediate", "Advanced", "Expert", "Master"];
config.leagueToLobbiesPrefix = {"Beginner": "beginner-lobbies", "Intermediate": "intermediate-lobbies", "Advanced": "advanced-lobbies", "Expert": "expert-lobbies", "Master": "master-lobbies"};
config.lobbiesToLeague = {"beginner-lobbies": "Beginner", "intermediate-lobbies": "Intermediate", "advanced-lobbies": "Advanced", "expert-lobbies": "Expert", "master-lobbies": "Master"}; // TODO: refactor.. being lazy
config.leagueRequirements = {"Beginner": 1, "Intermediate": 19, "Advanced": 24, "Expert": 28, "Master": 31};
config.leagueChannels = {"beginner-lobbies": "<#542420779493490692>", "beginner-lobbies-na": "", "intermediate-lobbies": "<#539360159554863114>", "advanced-lobbies": "<#539572170251173898>", "expert-lobbies": "<#542533721773965312>", "master-lobbies": "<#542927566479163420>"};
config.validRegions = ["NA", "EU", "SEA", "OCE", "SA"];
config.regionTags = {"NA": "<@&539339934327111680>", "EU": "<@&539339927931060225>", "SEA": "<@&539339931357544448>", "OCE": "<@&540223287742169089>", "SA": "<@&539339925229928450>"};

module.exports = config;
