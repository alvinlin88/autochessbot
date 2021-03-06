const expect = require('chai').expect;

const Lobbies = require("../lobbies.js");
const config = require("../config");

describe('BotInitializationTest', function() {
        it('should init lobbies', function() {
            const lobbies = new Lobbies();
            lobbies.restoreLobbies();
            config.leagueRoles.forEach(leagueRole => {
                let lobbiesInChannel = lobbies.getLobbiesInChannel(config.leagueToLobbiesPrefix[leagueRole]);
                expect(lobbiesInChannel).to.not.be.null;
            });
        });
});