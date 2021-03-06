const {Command, Arg, Args} = require('../command.js');
const VerifiedSteam = require('../../schema/verified-steam.js');
const User = require('../../schema/user.js');

function action(message, args) {
    return VerifiedSteam
        .banSteam(args.steam, args.reason, message.author.id)
        .then(verifiedSteam => {
            if (verifiedSteam === null) {
                return {
                    type: 'channelMention',
                    reply: `Steam id \`${args.steam}\` is already blacklisted.`
                }
            } else if (verifiedSteam.hasOwnProperty('userId') && verifiedSteam.userId !== null) {
                return User.findById(verifiedSteam.userId).then(bannedUser => ({
                    type: 'channelMention',
                    reply: `I have blacklisted steam id \`${args.steam}\`, don't forget to ban the linked user <@${bannedUser.discord}> as well!`
                }));
            } else {
                return {
                    type: 'channelMention',
                    reply: `I have blacklisted steam id \`${args.steam}\``
                };
            }
        });
}

module.exports = new Command({
    name: 'blacklist',
    aliases: [],
    permission: 'admin',
    args: [
        Args.STEAM,
        Args.TEXT('reason')
    ],
    action: action
});