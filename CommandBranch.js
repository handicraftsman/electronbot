const util = require('util');

module.exports = class {
  constructor(name, tdef, description) {
    this.name            = name;
    this.description     = description;
    this.helpDef         = "";
    this.specifiers      = [];
    this.flags           = [];
    this.options         = [];
    this.positionals     = [];
    this.accumulate      = false
    this.cooldown        = 0;
    this.lastUse         = new Map();
    this.handler         = undefined;

    for (let word of tdef.split(' ')) {
      word = word.trim();
      if (word.length == 0) { return; }
      if (word == '...') {
        this.accumulate = true;
        continue;
      }
      switch (word[0]) {
      case '!':
        this.specifiers.push(word.slice(1));
        break;
      case '-':
        this.flags.push(word.slice(1));
        break;
      case '=':
        this.options.push(word.slice(1));
        break;
      default:
        this.positionals.push(word);
        break;
      }
    }

    for (let word of this.specifiers) {
      this.helpDef += word + ' ';
    }

    for (let word of this.positionals) {
      this.helpDef += '<' + word + '> ';
    }

    if (this.accumulate) {
      this.helpDef += '... ';
    }

    for (let word of this.flags) {
      this.helpDef += '[--' + word + '] ';
    }

    for (let word of this.options) {
      this.helpDef += '[--' + word + '=?] ';
    }
  }

  [util.inspect.custom]() {
    return `<CommandBranch name='${this.name}'>`;
  }

  setHandler(handler) {
    this.handler = handler;
    return this;
  }

  setCooldown(cooldown) {
    this.cooldown = cooldown;
    return this;
  }
}
