const glob = require('glob')
    , path = require('path');

// All js files under commands/ will be imported as a command
const commands = glob.sync(__dirname +'/commands/*.js').map(file => require(path.resolve(file)));

const commandsByName = commands.reduce((map, command) => {
    map[command.name] = command;
    command.aliases.forEach(alias => {
        map[alias] = command;
    });
    return map;
}, {});

module.exports = {
    commands: commands,
    commandsByName: commandsByName
};