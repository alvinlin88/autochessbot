
var config = {};

config.steam_name = "ChessBot";
config.steam_user = "";
config.steam_pass = "";
config.steam_guard_code = "";
config.discord_token = "";

config.sqlitedb = "db.sqlite";
config.sentry = "sentry";

config.adminRoleName = "General Purpose Staff";
config.leagueRoles = ["Intermediate League", "Advanced League"];
config.leagueToLobbies = {"Intermediate League": "intermediate-lobbies", "Advanced League": "advanced-lobbies"};
config.lobbiesToLeague = {"intermediate-lobbies": "Intermediate League", "advanced-lobbies": "Advanced League"}; // TODO: refactor.. being lazy
config.leagueRequirements = {"Intermediate League": 19, "Advanced League": 25};
config.leagueChannels = {"Intermediate League": "<#539360159554863114>", "Advanced League": "<#539572170251173898>"};
config.validRegions = ["NA", "EU", "SEA", "OCE", "SA"];
config.regionTags = {"NA": "<@&540734173506437120>", "EU": "EU", "SEA": "SEA", "OCE": "OCE", "SA": "SA"};

module.exports = config;
