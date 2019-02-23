const rolesMap = {}

const setupRoles = roles => {
  roles.forEach(role => {
    rolesMap[role.name.toLowerCase()] = role.id
  })
}

const checkRole = (member, role) => {
  return member.roles.has(rolesMap[role.toLowerCase()])
}

module.exports = {
  setupRoles,
  checkRole
}
