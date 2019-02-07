var config = {};

config.steam_name = "ChessBot";
config.steam_user = "";
config.steam_pass = "";
config.steam_guard_code = "";
config.discord_token = "";

config.sqlitedb = "db.sqlite";
config.sentry = "sentry";
config.lobbies = "lobbies";

config.adminRoleName = "Staff";
config.leagueRoles = ["Tester", "Beginner", "Intermediate", "Advanced", "Expert", "Master"];
config.leagueToLobbies = {"Tester": "tester-lobbies", "Beginner": "beginner-lobbies", "Intermediate": "intermediate-lobbies", "Advanced": "advanced-lobbies", "Expert": "expert-lobbies", "Master": "master-lobbies"};
config.lobbiesToLeague = {"tester-lobbies": "Tester", "beginner-lobbies": "Beginner", "intermediate-lobbies": "Intermediate", "advanced-lobbies": "Advanced", "expert-lobbies": "Expert", "master-lobbies": "Master"}; // TODO: refactor.. being lazy
config.leagueRequirements = {"Beginner": 1, "Intermediate": 19, "Advanced": 24, "Expert": 28, "Master": 31, "Tester": 999};
config.leagueChannels = {"Tester": "<#542432713366568961>", "Beginner": "<#542420779493490692>", "Intermediate": "<#539360159554863114>", "Advanced": "<#539572170251173898>", "Expert": "<#542533721773965312>", "Master": "<#542927566479163420>"};
config.validRegions = ["NA", "EU", "SEA", "OCE", "SA"];
config.regionTags = {"NA": "<@&539339934327111680>", "EU": "<@&539339927931060225>", "SEA": "<@&539339931357544448>", "OCE": "<@&540223287742169089>", "SA": "<@&539339925229928450>"};

module.exports = config;
