const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

const {commands, commandsByName} = require('../command/all-commands.js');
const Arg = require("../command/command").Arg;
const Command = require("../command/command").Command;

// Note: if this test suite fails or errors out, check your new/changed command's settings to fix.
describe('CommandsAndArgumentsTest', function () {
    it('Commands should not have conflicting name or alias', function () {
        // Just count number of all aliases.
        // If no override happened, the keys of commands indexed by name/alias should equal number of commands + total of aliases
        let numOfCommands = commands.length;
        let numOfAliases = commands.reduce((total, command) => total + command.aliases.length, 0);
        expect(Object.keys(commandsByName).length).to.equal(numOfCommands + numOfAliases);
    });

    it('Only the very last Arg can be multi', function () {
        for (let command of commands) {
            for (let arg of command.args.slice(0, -1)) {
                expect(arg.multi).to.not.equal(true);
            }
        }
    });

    it('If one Arg is optional, all following ones need to be optional', function () {
        for (let command of commands) {
            let firstOptional = command.args.findIndex(arg => arg.optional === true);
            if (firstOptional !== -1) {
                for (let arg of command.args.slice(firstOptional + 1)) {
                    expect(arg.optional).to.equal(true);
                }
            }
        }
    });
});

describe('ArgumentParsingTest', function () {
    const testArg1 = new Arg({name: 'testArg1', validate: parseInt});
    const testArg2 = new Arg({name: 'testArg2', validate: arg => arg === "42"});
    const testArg3 = new Arg({name: 'testArg2', multi:true, optional:true});
    const testArg4 = new Arg({name: 'testArg2', multi:true, optional:false});

    const noArgs = new Command({name: 'noArgs'});
    const oneRequired = new Command({name: 'oneRequired', args: [testArg1]});
    const twoRequired = new Command({name: 'twoRequired', args: [testArg1, testArg2]});
    const oneRequiredAndOptionalMulti = new Command({name: 'oneRequiredAndOptionalMulti', args: [testArg1, testArg3]});
    const oneRequiredAndRequiredMulti = new Command({name: 'oneRequiredAndRequiredMulti', args: [testArg1, testArg4]});


    it('Invalid args', function () {
        expect(() => oneRequired.parseArgs(["abc"])).to.throw('Invalid args');
        expect(() => oneRequired.parseArgs(["123"])).to.not.throw();
        expect(() => twoRequired.parseArgs(["123", "999"])).to.throw('Invalid args');
        expect(() => twoRequired.parseArgs(["123", "42"])).to.not.throw();
    });

    it('Not enough args', function () {
        expect(() => noArgs.parseArgs([])).to.not.throw();
        expect(() => oneRequired.parseArgs([])).to.throw('Not enough args');
        expect(() => oneRequired.parseArgs(["123"])).to.not.throw();
        expect(() => twoRequired.parseArgs(["123"])).to.throw('Not enough args');

        expect(() => oneRequiredAndOptionalMulti.parseArgs(["123"])).to.not.throw();
        expect(() => oneRequiredAndOptionalMulti.parseArgs(["123", "blah"])).to.not.throw();
        expect(() => oneRequiredAndRequiredMulti.parseArgs(["123"])).to.throw('Not enough args');
        expect(() => oneRequiredAndRequiredMulti.parseArgs(["123", "blah"])).to.not.throw();
    });
});