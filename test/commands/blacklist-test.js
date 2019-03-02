const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
const VerifiedSteam = require('../../schema/verified-steam.js');
chai.use(chaiAsPromised);
const blacklist = require('../../command/commands/blacklist.js');

describe('Tests for !blacklist', () => {
    let newSteam = '12345678912345671';
    let alreadyVerified = '12345678912345672';
    let alreadyBlacklisted = '12345678912345673';

    // fake message to work around permission check
    let message = {
        author: {
            id: 'discorduser1'
        },
        member: {
            roles: {
                has: () => true
            }
        },
        guild: {
            roles: {
                id: 1,
                find: () => ({id: 1})
            }
        }
    };

    before(() =>
        Promise.all([
            VerifiedSteam.findOneBySteam(newSteam).then(verifiedSteam => {
                if (verifiedSteam !== null) {
                    return verifiedSteam.destroy();
                }
                return verifiedSteam;
            }),
            VerifiedSteam.upsert({steam: alreadyVerified}),
            VerifiedSteam.upsert({steam: alreadyBlacklisted, banned: true})
        ]));

    it('Blacklist a new steam', () => {
        return expect(blacklist.execute(message, [newSteam, 'reason 1'])).to.eventually.deep.equal(
            {
                type: 'channelMention',
                reply: `I have blacklisted steam id \`${newSteam}\``
            }
        );
    });

    it('Blacklist a already verified steam', () => {
        return expect(blacklist.execute(message, [alreadyVerified, 'reason 2 blah blah'])).to.eventually.deep.equal(
            {
                type: 'channelMention',
                reply: `I have blacklisted steam id \`${alreadyVerified}\``
            }
        );
    });

    it('Blacklist a already blacklisted steam', () => {
        return expect(blacklist.execute(message, [alreadyBlacklisted, 'reason 3 hehehe'])).to.eventually.deep.equal(
            {
                type: 'channelMention',
                reply: `I have blacklisted steam id \`${alreadyBlacklisted}\``
            }
        );
    });
});