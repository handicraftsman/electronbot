const util = require('util');

module.exports = class {
  constructor(name, version, description, bot) {
    this.name          = name;
    this.log           = require('./newLog')(`?${name}`);
    this.log.important('Hello, bot!');
    this.version       = version;
    this.description   = description;
    this.bot           = bot;
    this.eventHandlers = {};
    this.commands      = {};
    this.groups        = {};
    this.helpEntries   = {};
  }

  [util.inspect.custom]() {
    return `<Plugin name='${this.name}'>`;
  }

  addHelp(name, entry) {
    this.helpEntries[name] = entry;
  }

  newCommand(name) {
    let c = new (require('./Command'))(name);
    this.commands[name] = c;
    return c;
  }

  newGroup(name) {
    let g = new Set();
    g.addCmd = (cmd, branch) => {
      g.add(this.name + '/' + cmd + '/' + branch);
      return g;
    }
    this.groups[name] = g;
    return g;
  }
}
