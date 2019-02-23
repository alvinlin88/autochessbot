const config = require("../../channels-config")
const LeaguesAPI = require("../LeaguesAPI")

const channelsWithLobbies = {
  ...config,
  lobbies: LeaguesAPI.getAllLeaguesChannels()
}

const all = []
for (let scope in channelsWithLobbies) {
  channelsWithLobbies[scope].forEach(channel => all.push(channel))
}

const channelsWithAll = {
  ...channelsWithLobbies,
  all
}

const channelsToScopes = {}
for (let scope in channelsWithLobbies) {
  channelsWithLobbies[scope].forEach(channel => {
    channelsToScopes[channel] = scope
  })
}

const getScopeChannels = name => {
  if (!channelsWithAll[name]) return [] // The scope is not found
  return channelsWithAll[name]
}

const getScopeNameFromChannel = channel => {
  if (!channelsToScopes[channel]) return "other" // The channel is not in any scope
  return channelsToScopes[channel]
}

const isChannelInScopes = ({ channel, scopes, isStrict, isAdmin }) => {
  const channelScope = getScopeNameFromChannel(channel)

  const isInScopes =
    scopes.includes(channelScope) ||
    (channelScope !== "other" && scopes.includes("all"))

  if (isStrict) return isInScopes

  if (isAdmin && !isInScopes) return true

  return isInScopes
}

module.exports = {
  getScopeChannels,
  getScopeNameFromChannel,
  isChannelInScopes
}
