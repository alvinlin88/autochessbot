const {Command, Args} = require('../command.js');
const Tournament = require('../../schema/tournament.js');
const rankUtil = require('../../rank-util.js');

function action(message, args) {
    return Tournament.createTournament(args.name, rankUtil.parseRank(args.rank))
        .then(() => ({
            type: 'channelMention',
            reply: `Created tournament \`${args.name}\` with rank requirement \`${args.rank}\``
        }));
}

module.exports = new Command({
    name: 'createtournament',
    aliases: ['tourney'],
    permission: 'admin',
    args: [
        Args.RANK,
        Args.TEXT('name')
    ],
    action: action
});