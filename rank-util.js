module.exports = {
    parseRank: function (rankInput) {
        let stripped = rankInput.toLowerCase().replace(/\W+/g, '');
        let rankStr = stripped.replace(/[0-9]/g, '');
        let rankNum = stripped.replace(/[a-z]/g, '');

        let mappings = {"pawn": 0, "knight": 1, "bishop": 2, "rook": 3, "king": 4, "queen": 5};

        if (rankStr === "king") return 37;
        if (rankStr === "queen") return 38;

        if (rankNum < 1 || rankNum > 9) {
            return null;
        }
        if (!mappings.hasOwnProperty(rankStr)) {
            return null;
        }

        let rank = 0;

        rank = rank + mappings[rankStr] * 9;
        rank = rank + parseInt(rankNum);

        return rank;
    },

    getRank: function (rank) {
        if (rank === 0) {
            return {name: "Unranked"};
        }
        if (rank > 0 && rank <= 9) {
            return {icon: "♟", name: "Pawn", level: (rank).toString()};
        }
        if (rank >= 10 && rank < (10 + 9)) {
            return {icon: "♞", name: "Knight", level: (rank - 9).toString()};
        }
        if (rank >= (10 + 9) && rank < (10 + 9 + 9)) {
            return {icon: "♝", name: "Bishop", level: (rank - 9 - 9).toString()};
        }
        if (rank >= (10 + 9 + 9) && rank < (10 + 9 + 9 + 9)) {
            return {icon: "♜", name: "Rook", level: (rank - 9 - 9 - 9).toString()};
        }
        if (rank >= (10 + 9 + 9 + 9) && rank < (10 + 9 + 9 + 9 + 1)) {
            return {icon: "♚", name: "King"};
        }
        if (rank >= (10 + 9 + 9 + 9 + 1)) {
            return {icon: "♛", name: "Queen"};
        }
        // if (rank >= (10 + 9 + 9 + 9) && rank < (10 + 9 + 9 + 9 + 1)) { return "King-" + (rank - 9 - 9 - 9 - 9).toString(); }
        // if (rank >= (10 + 9 + 9 + 9 + 1)) { return "Queen-" + (rank - 9 - 9 - 9 - 9 - 1).toString(); }
        return "ERROR";
    },

    getRankString: function (rank) {
        let rankData = this.getRank(rank);
        let iconStr = "";
        if (rankData.hasOwnProperty("icon")) {
            iconStr = rankData.icon + " ";
        }
        if (rankData.hasOwnProperty("icon") && rankData.hasOwnProperty("name")) {
            if (rankData.hasOwnProperty("level")) {
                return iconStr + "**" + rankData.name + "-" + rankData.level + "**";
            } else {
                return iconStr + "**" + rankData.name + "**";
            }
        }
        return "ERROR";
    }
};