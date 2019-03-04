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
            VerifiedSteam.upsert({steam: alreadyVerified, banned: false}),
            VerifiedSteam.upsert({steam: alreadyBlacklisted, banned: true})
        ]));

    it('Blacklist a new steam', () => {
        let now = new Date();
        let reason = 'reason 1';

        return blacklist.execute(message, [newSteam, reason]).then(
            result => {
                expect(result).to.deep.equal({
                    type: 'channelMention',
                    reply: `I have blacklisted steam id \`${newSteam}\``
                });
                return VerifiedSteam.findOneBySteam(newSteam).then(verifiedSteam => {
                    expect(verifiedSteam.banned).to.be.true;
                    expect(verifiedSteam.bannedAt).to.be.above(now);
                    expect(verifiedSteam.banReason).to.equal(reason);
                });
            }
        );
    });

    it('Blacklist a already verified steam', () => {
        let now = new Date();
        const reason = 'reason 2 blah blah';

        return blacklist.execute(message, [alreadyVerified, reason]).then(
            result => {
                expect(result).to.deep.equal({
                    type: 'channelMention',
                    reply: `I have blacklisted steam id \`${alreadyVerified}\``
                });
                return VerifiedSteam.findOneBySteam(alreadyVerified).then(verifiedSteam => {
                    expect(verifiedSteam.banned).to.be.true;
                    expect(verifiedSteam.bannedAt).to.be.above(now);
                    expect(verifiedSteam.banReason).to.equal(reason);
                });
            }
        );
    });

    it('Blacklist a already blacklisted steam', () => {
        let now = new Date();
        const reason = 'reason 3 hehe';

        return blacklist.execute(message, [alreadyBlacklisted, reason]).then(
            result => {
                expect(result).to.deep.equal({
                    type: 'channelMention',
                    reply: `Steam id \`${alreadyBlacklisted}\` is already blacklisted.`
                });
                return VerifiedSteam.findOneBySteam(alreadyBlacklisted).then(verifiedSteam => {
                    expect(verifiedSteam.banned).to.be.true;
                    expect(verifiedSteam.updatedAt).to.be.below(now);
                });
            }
        );
    });
});