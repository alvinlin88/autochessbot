const {Command, Args} = require('../command.js');
const Tournament = require('../../schema/tournament.js');
const User = require('../../schema/user.js');
const dacService = require('../../dac-service.js');
const rankUtil = require('../../rank-util.js');

function createRegistration(user, args, tournament) {
    return Tournament
        .createRegistration(user.steam, args.region)
        .then(registration => registration.setUser(user))
        .then(registration => tournament.addRegistration(registration))
        .then(() => ({
            type: 'channelMention',
            reply: `You have successfully registered for \`${tournament.name}\``
        }));
}

function action(message, args) {
    return Tournament.latest().then(tournament =>
        User.findByDiscord(message.author.id).then(user => dacService.getRankFromSteamId(user.steam).then(rank => {
            if (rank.mmr_level < tournament.minRank) {
                return {
                    type: 'channelMention',
                    reply: `Tournament rank requirement: ${rankUtil.getRankString(tournament.minRank)}. Your rank: ${rankUtil.getRankString(rank.mmr_level)}`
                }
            } else {
                return createRegistration(user, args, tournament);
            }
        })));
}

module.exports = new Command({
    name: 'register',
    aliases: ['checkin'],
    args: [
        Args.REGION
    ],
    action: action
});