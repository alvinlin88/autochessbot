const expect = require('chai').expect;

const {commands, commandsByName} = require('../command/all-commands.js');
const {Command, Arg, Args} = require('../command/command');

// Note: if this test suite fails or errors out, check your new/changed command's settings to fix.
describe('CommandsAndArgumentsTest', () => {
    it('Commands should not have conflicting name or alias', () => {
        // Just count number of all aliases.
        // If no override happened, the keys of commands indexed by name/alias should equal number of commands + total of aliases
        let numOfCommands = commands.length;
        let numOfAliases = commands.reduce((total, command) => total + command.aliases.length, 0);
        expect(Object.keys(commandsByName).length).to.equal(numOfCommands + numOfAliases);
    });

    it('Only the very last Arg can be multi or text', () => {
        for (let command of commands) {
            for (let arg of command.args.slice(0, -1)) {
                expect(arg.multi).to.not.equal(true);
                expect(arg.text).to.not.equal(true);
            }
        }
    });

    it('If one Arg is optional, all following ones need to be optional', () => {
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

describe('ArgumentParsingTest', () => {
    const testArg1 = new Arg({name: 'testArg1', validate: parseInt});
    const testArg2 = new Arg({name: 'testArg2', validate: arg => arg === '42'});
    const testArg3 = new Arg({name: 'testArg3', multi: true, optional: true});
    const testArg4 = new Arg({name: 'testArg4', multi: true, optional: false});
    const testArg5 = Args.TEXT('testArg5', true);
    const testArg6 = Args.TEXT('testArg6');
    const testArg7 = new Arg({name: 'testArg7', optional: true});

    const noArgs = new Command({name: 'noArgs'});
    const oneRequired = new Command({name: 'oneRequired', args: [testArg1]});
    const twoRequired = new Command({name: 'twoRequired', args: [testArg1, testArg2]});

    // One required args with additional args
    const optionalMulti = new Command({name: 'optionalMulti', args: [testArg1, testArg3]});
    const requiredMulti = new Command({name: 'requiredMulti', args: [testArg1, testArg4]});
    const optionalText = new Command({name: 'optionalText', args: [testArg1, testArg5]});
    const requiredText = new Command({name: 'requiredText', args: [testArg1, testArg6]});
    const optional = new Command({name: 'optional', args: [testArg1, testArg7]});


    it('Invalid args', () => {
        expect(() => oneRequired.parseArgs(['abc'])).to.throw('Invalid args');
        expect(oneRequired.parseArgs(['123'])).to.deep.equal({testArg1: '123'});

        expect(() => twoRequired.parseArgs(['123', '999'])).to.throw('Invalid args');
        expect(twoRequired.parseArgs(['123', '42'])).to.deep.equal({testArg1: '123', testArg2: '42'});
    });

    it('Not enough args', () => {
        expect(noArgs.parseArgs([])).to.deep.equal({});
        expect(() => oneRequired.parseArgs([])).to.throw('Not enough args');
        expect(() => twoRequired.parseArgs(['123'])).to.throw('Not enough args');

        expect(() => optionalMulti.parseArgs(['123'])).to.not.throw();
        expect(optionalMulti.parseArgs(['123', 'blah', 'blah'])).to.deep.equal({
            testArg1: '123',
            testArg3: ['blah', 'blah']
        });
        expect(() => requiredMulti.parseArgs(['123'])).to.throw('Not enough args');
        expect(requiredMulti.parseArgs(['123', 'blah', 'blah'])).to.deep.equal({
            testArg1: '123',
            testArg4: ['blah', 'blah']
        });

        expect(() => optionalText.parseArgs(['123'])).to.not.throw();
        expect(optionalText.parseArgs(['123', 'blah', 'blah'])).to.deep.equal({testArg1: '123', testArg5: 'blah blah'});
        expect(() => requiredText.parseArgs(['123'])).to.throw('Not enough args');
        expect(requiredText.parseArgs(['123', 'blah', 'blah'])).to.deep.equal({testArg1: '123', testArg6: 'blah blah'});

        expect(optional.parseArgs(['123'])).to.deep.equal({testArg1: '123'});
        expect(optional.parseArgs(['123', '456'])).to.deep.equal({testArg1: '123', testArg7: '456'});
    });

    it('Help string', () => {
        expect(noArgs.help).to.equal('Usage: !noArgs');
        expect(oneRequired.help).to.equal('Usage: !oneRequired [testArg1]');
        expect(twoRequired.help).to.equal('Usage: !twoRequired [testArg1] [testArg2]');

        expect(optionalMulti.help).to.equal('Usage: !optionalMulti [testArg1] [*testArg3...]');
        expect(requiredMulti.help).to.equal('Usage: !requiredMulti [testArg1] [testArg4...]');

        expect(optionalText.help).to.equal('Usage: !optionalText [testArg1] [*testArg5]');
        expect(requiredText.help).to.equal('Usage: !requiredText [testArg1] [testArg6]');

        expect(optional.help).to.equal('Usage: !optional [testArg1] [*testArg7]');
    })
});