/**
 * This file defines 2 classes: Command and Arg. A minimal command has name and action, which will perform the
 * action if the bot receives a message "!<name>".
 *
 * The action should be a function that returns a promise that rejects if the action fails, and the bot will reply with
 * the reject reason.
 *
 * If you add an Arg to a Command, it will then try to match the args parsed from the message and rejects if
 * validation fails. The validation verifies the number of args and each arg's format by running the Arg's validate
 * method.
 *
 * This file also provides a few common Arg like STEAM and DISCORD.
 */

const config = require('../config.js');

class Arg {
    constructor(options) {
        this.name = options.name;
        this.optional = options.optional === true;
        this.multi = options.multi === true;
        this.text = options.text === true;
        if (typeof options.validate === 'function') {
            this.validate = options.validate;
        } else {
            this.validate = () => true;
        }
        this.help = `[${this.optional ? '*' : ''}${this.name}${this.multi && !this.text ? '...' : ''}]`;
    }
}

class Command {
    constructor(options) {
        this.name = options.name;
        this.aliases = [];
        if (options.aliases) {
            for (const alias of options.aliases) {
                this.aliases.push(alias);
            }
        }
        this.permission = options.permission;
        this.args = [];
        if (options.args) {
            for (const arg of options.args) {
                this.args.push(arg);
            }
        }
        this.action = options.action;
        this.help = `Usage: !${this.name} ${this.args.map(arg => arg.help).join(' ')}`.trim();
    }

    execute(message, inputArgs) {
        if (this.permission === 'admin') {
            if (!message.member.roles.has(message.guild.roles.find(r => r.name === config.adminRoleName).id)) {
                return Promise.resolve({
                    type: 'dm',
                    reply: `You do not have permission to use admin command: ${this.name}`
                });
            }
        }

        try {
            let parsedArgs = this.parseArgs(inputArgs);
            return this.action(message, parsedArgs);
        } catch (e) {
            return Promise.resolve({
                type: 'dm',
                reply: `Your command ${message.content} has error: ${e.message}\n${this.help}`
            });
        }
    }

    // todo: warning for extra args not used.
    parseArgs(inputArgs) {
        const parsedArgs = {};

        let current = 0;
        for (const arg of this.args) {
            if (arg.multi || arg.text) {
                const multiArgs = [];
                if (!arg.optional && current >= inputArgs.length) {
                    // Require at least 1 value, reject if no args left
                    throw new Error('Not enough args');
                } else {
                    // multi/text is always the last arg, match all remaining args.
                    for (; current < inputArgs.length; current++) {
                        if (arg.validate(inputArgs[current])) {
                            multiArgs.push(inputArgs[current]);
                        } else {
                            throw new Error('Invalid args');
                        }
                    }
                    // Array for multi, and a single string for text
                    parsedArgs[arg.name] = arg.multi ? multiArgs : multiArgs.join(' ');
                }
            } else if (current < inputArgs.length) { // Match the args
                if (arg.validate(inputArgs[current])) {
                    parsedArgs[arg.name] = inputArgs[current];
                    current++;
                } else {
                    throw new Error('Invalid args');
                }
            } else {
                // No more args, we can proceed if all the remaining args are optional
                // Because we know if one arg is optional the ones after must all be optional, just check this one
                if (!arg.optional) {
                    throw new Error('Not enough args');
                }
            }
        }

        return parsedArgs;
    }
}

//todo auto doc
module.exports = {
    Command: Command,

    Arg: Arg,

    // Commonly used args
    Args: {
        STEAM: new Arg({
            name: 'steam',
            validate: steam => parseInt(steam) && steam.length === 17,
        }),

        DISCORD: new Arg({
            name: 'discord'
        }),

        TEXT(name, optional = false) {
            return new Arg({
                name: name,
                text: true,
                optional: optional
            });
        }
    }
};