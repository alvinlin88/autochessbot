const { expect } = require("chai")

const LobbiesAPIClass = require("../helpers/LobbiesAPI/LobbiesAPIClass")
const LeaguesAPI = require("../helpers/LeaguesAPI")

describe("BotInitializationTest", function() {
  it("should init lobbies", function() {
    const LobbiesAPI = new LobbiesAPIClass()
    LobbiesAPI.restoreLobbies()
    LeaguesAPI.getLeagues().forEach(league => {
      const basename = LeaguesAPI.getBasenameFromLeague(league)
      const lobbiesInChannel = LobbiesAPI.getLobbiesInChannel(basename)
      expect(lobbiesInChannel).to.not.be.null
    })
  })
})
