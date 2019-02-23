const client = require("../../helpers/client")
const logger = require("../../helpers/logger.js")
const MessagesAPI = require("../../helpers/MessagesAPI")
const RanksAPI = require("../../helpers/RanksAPI")
const LobbiesAPI = require("../../helpers/LobbiesAPI")
const {
  leagueLobbies,
  leagueChannelToRegion
} = require("../../constants/leagues")
const {
  lobbiesToLeague,
  adminRoleName,
  leagueRoles,
  leagueRequirements,
  validRegions,
  exemptLeagueRolePruning
} = require("../../config")
const randtoken = require("rand-token")
const UserAPI = require("../../helpers/UserAPI")
const VerifiedSteamAPI = require("../../helpers/VerifiedSteamAPI")
const TournamentAPI = require("../../helpers/TournamentAPI")
const parseDiscordId = require("../../helpers/discord/parseDiscordID")
const getSteamPersonaNames = require("../../helpers/steam/getSteamPersonaNames")

let botDownMessage =
  "Bot is restarting. Lobby commands are currently disabled. Be back in a second!"
let disableLobbyCommands = false
let disableLobbyHost = false

const restartbot = ({
  parsedCommand,
  user,
  message,
  leagueRole,
  leagueChannel,
  leagueChannelRegion
}) => {
  if (
    !message.member.roles.has(
      message.guild.roles.find(r => r.name === adminRoleName).id
    )
  )
    return 0
  disableLobbyCommands = true

  LobbiesAPI.backupLobbies(logger)

  let famousLastWords = [
    "Hey fellas! How about this for a headline for tomorrow’s paper? ‘French fries.'",
    "What the devil do you mean to sing to me, priest? You are out of tune.",
    "Good. A woman who can fart is not dead.",
    "I’d hate to die twice. It’s so boring.",
    "I did not get my Spaghetti-O’s; I got spaghetti. I want the press to know this.",
    "I’d like to thank the Academy for my lifetime achievement award that I will eventually get.",
    "I knew it! I knew it! Born in a hotel room and, goddamn it, dying in a hotel room.",
    "And now for a final word from our sponsor—.",
    "Remember, Honey, don’t forget what I told you. Put in my coffin a deck of cards, a mashie niblick, and a pretty blonde.",
    "Damn it! Don’t you dare ask God to help me!",
    "Yeah, country music.",
    "Bring me a bullet-proof vest.",
    "Surprise me.",
    "Thank god. I’m tired of being the funniest person in the room.",
    "I’ve had 18 straight whiskeys... I think that’s the record.",
    "They couldn’t hit an elephant at this dist—",
    "On the contrary.",
    "I should have never switched from scotch to martinis.",
    "I am sorry to bother you chaps. I don’t know how you get along so fast with the traffic on the roads these days.",
    "Now is not the time for making new enemies.",
    "I’m looking for loopholes.",
    "This wallpaper and I are fighting a duel to the death. Either it goes or I do.",
    "Gun’s not loaded… see?",
    "Am I dying, or is this my birthday?",
    "Oh, you young people act like old men. You have no fun.",
    "Codeine... bourbon...",
    "No.",
    "I’m bored with it all.",
    "This is no way to live.",
    "I desire to go to Hell and not to Heaven. In the former I shall enjoy the company of popes, kings and princes, while in the latter are only beggars, monks and apostles.",
    "Turn me over — I’m done on this side.",
    "Now why did I do that?",
    "Don’t let it end like this. Tell them I said something important.",
    // "Oh Lord, forgive the misprints!",
    // "All right, then, I’ll say it: Dante makes me sick.",
    "I'll be back!",
    "Yes, master.",
    "Sentences are the building blocks of paragraphs.",
    "Beep boop, I am a robot. Haha just kidding!",
    "Sometimes it's better to remain silent and be thought a fool, rather than open your mouth and remove all doubt.",
    "Mitochondria is the powerhouse of the cell",
    "Beep boop, I am a :pepega: Haha not kidding :pepega:"
  ]
  MessagesAPI.sendToChannelWithMention(
    message.channel.id,
    message.author.id,
    famousLastWords[Math.floor(Math.random() * famousLastWords.length)]
  )
  setTimeout(function() {
    process.exit(1)
  }, 1000)
}

module.exports = {
  function: restartbot,
  isAdmin: true,
  scopes: ["all"]
}
