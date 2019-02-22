const messageAuthorHasRole = (message, role) => {
  return message.member.roles.has(
    message.guild.roles.find(r => r.name === role).id
  )
}

module.exports = {
  messageAuthorHasRole
}
