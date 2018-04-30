const util = require('util');

const CommandBranch = require('./CommandBranch');

module.exports = class {
  constructor(name) {
    this.name     = name;
    this.branches = new Map();
  }

  [util.inspect.custom]() {
    return `<Command name='${this.name}'>`;
  }

  addBranch(name, definition, description) {
    let b = new CommandBranch(name, definition, description);
    this.branches[name] = b;
    return b;
  }
}
