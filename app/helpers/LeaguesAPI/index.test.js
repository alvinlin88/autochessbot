const { expect } = require("chai")
const LeaguesAPIConstructor = require("./LeaguesAPI")

const config = {
  leagues: ["intermediate", "beginner"],
  regions: ["ru", "euw"],
  requirements: {
    intermediate: 19,
    beginner: 1
  }
}

describe("LeaguesAPI", () => {
  const LeaguesAPI = LeaguesAPIConstructor(config)

  describe("getLeagues", () => {
    it("should return leagues list", () => {
      expect(LeaguesAPI.getLeagues()).to.equal(config.leagues)
    })
  })

  describe("getRegions", () => {
    it("should return leagues list", () => {
      expect(LeaguesAPI.getRegions()).to.equal(config.regions)
    })
  })

  describe("getRequirements", () => {
    it("should return leagues list", () => {
      expect(LeaguesAPI.getRequirements()).to.equal(config.requirements)
    })
  })

  describe("getAllLeaguesChannels", () => {
    it("should return all leagues channels", () => {
      expect(LeaguesAPI.getAllLeaguesChannels()).to.eql([
        "intermediate-lobbies",
        "intermediate-lobbies-ru",
        "intermediate-lobbies-euw",
        "beginner-lobbies",
        "beginner-lobbies-ru",
        "beginner-lobbies-euw"
      ])
    })
  })

  describe("getBasenameFromLeague", () => {
    it("should return league basename", () => {
      expect(LeaguesAPI.getBasenameFromLeague("beginner")).to.equal(
        "beginner-lobbies"
      )
    })
    it("should throw error with nonexistent league", () => {
      const league = ""
      expect(() => LeaguesAPI.getBasenameFromLeague(league)).to.throw(
        `Cannot find key "${league}" in object`
      )
    })
  })

  describe("getChannelsFromLeague", () => {
    it("should return league channels", () => {
      expect(LeaguesAPI.getChannelsFromLeague("beginner")).to.eql([
        "beginner-lobbies",
        "beginner-lobbies-ru",
        "beginner-lobbies-euw"
      ])
    })
    it("should throw error with nonexistent league", () => {
      const league = ""
      expect(() => LeaguesAPI.getChannelsFromLeague(league)).to.throw(
        `Cannot find key "${league}" in object`
      )
    })
  })

  describe("getLeagueFromChannel", () => {
    it("should return league from basename", () => {
      expect(LeaguesAPI.getLeagueFromChannel("beginner-lobbies")).to.equal(
        "beginner"
      )
    })
    it("should return league from channel with region", () => {
      expect(LeaguesAPI.getLeagueFromChannel("beginner-lobbies-ru")).to.equal(
        "beginner"
      )
    })
    it("should throw error with nonexistent channel", () => {
      const channel = ""
      expect(() => LeaguesAPI.getLeagueFromChannel(channel)).to.throw(
        `Cannot find key "${channel}" in object`
      )
    })
  })

  describe("getLeagueRequirement", () => {
    it("should return requirement", () => {
      expect(LeaguesAPI.getLeagueRequirement("beginner")).to.equal(1)
      expect(LeaguesAPI.getLeagueRequirement("intermediate")).to.equal(19)
    })
    it("should throw error with nonexistent league", () => {
      const league = ""
      expect(() => LeaguesAPI.getLeagueRequirement(league)).to.throw(
        `Cannot find key "${league}" in object`
      )
    })
  })

  describe("getChannelRequirement", () => {
    it("should return requirement from basename", () => {
      expect(LeaguesAPI.getChannelRequirement("beginner-lobbies")).to.equal(1)
    })
    it("should return requirement from channel with region", () => {
      expect(
        LeaguesAPI.getChannelRequirement("intermediate-lobbies-ru")
      ).to.equal(19)
    })
    it("should throw error with nonexistent channel", () => {
      const channel = ""
      expect(() => LeaguesAPI.getChannelRequirement(channel)).to.throw(
        `Cannot find key "${channel}" in object`
      )
    })
  })
})
