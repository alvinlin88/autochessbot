const { leagues, regions, requirements } = require("../../leagues-config")

const leaguesChannels = []

const basenames = {}

const leaguesToChannels = {}
const channelsToLeagues = {}

leagues.forEach(league => {
  leaguesToChannels[league] = []

  const basename = league + "-lobbies"
  basenames[league] = basename
  leaguesChannels.push(basename)

  leaguesToChannels[league].push(basename)
  channelsToLeagues[basename] = league

  regions.forEach(region => {
    const name = league + "-lobbies-" + region
    leaguesChannels.push(name)

    leaguesToChannels[league].push(name)
    channelsToLeagues[name] = league
  })
})

const get = (obj, key) => {
  const lcKey = key.toLowerCase()

  if (!obj[lcKey]) throw new Error(`Cannot find key "${lcKey}" in object`)

  return obj[lcKey]
}

const getLeagues = () => leagues
const getRegions = () => regions
const getRequirements = () => requirements

const getAllLeaguesChannels = () => leaguesChannels

const getBasenameFromLeague = league => get(basenames, league)

const getChannelsFromLeague = league => get(leaguesToChannels, league)
const getLeagueFromChannel = channel => get(channelsToLeagues, channel)

const getLeagueRequirement = league => get(requirements, league)
const getChannelRequirement = channel =>
  getLeagueRequirement(getLeagueFromChannel(channel))

module.exports = {
  getLeagues,
  getRegions,
  getRequirements,

  getAllLeaguesChannels,

  getBasenameFromLeague,

  getChannelsFromLeague,
  getLeagueFromChannel,

  getLeagueRequirement,
  getChannelRequirement
}
