const { expect } = require("chai")

const LobbiesAPIClass = require("../helpers/LobbiesAPI/LobbiesAPIClass")
const config = require("../config")

describe("BotInitializationTest", function() {
  it("should init lobbies", function() {
    const LobbiesAPI = new LobbiesAPIClass()
    LobbiesAPI.restoreLobbies()
    config.leagueRoles.forEach(leagueRole => {
      let lobbiesInChannel = LobbiesAPI.getLobbiesInChannel(
        config.leagueToLobbiesPrefix[leagueRole]
      )
      expect(lobbiesInChannel).to.not.be.null
    })
  })
})
