function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

module.exports = class extends (require('../Plugin')) {
  constructor(name, bot) {
    super(name, require('../version'), 'The core plugin', bot);

    this.newGroup('world')
      .addCmd('key', 'root')
      .addCmd('key', 'key')
      .addCmd('help', 'root')
      .addCmd('help', 'what')
      ;

    this.newGroup('admin')
      .addCmd('reload', 'root')
      .addCmd('raw', 'root')
      .addCmd('join', 'targeted')
      .addCmd('part', 'root')
      .addCmd('part', 'targeted')
      .addCmd('group', 'add')
      .addCmd('group', 'remove')
      .addCmd('group', 'check')
      .addCmd('flag', 'enable')
      .addCmd('flag', 'disable')
      .addCmd('flag', 'remove')
      .addCmd('flag', 'check')
      ;

    let cmdHelp = this.newCommand('help');
    cmdHelp.addBranch(
      'root',
      '',
      'Shows a general help message'
    ).setHandler((e, c) => {
      e.nreply(`http://${this.bot.config.help.publicHost}:${this.bot.config.help.publicPort}/`);
    }).setCooldown(5);
    cmdHelp.addBranch(
      'what',
      'what',
      'Shows as help message for a plugin or a command'
    ).setHandler((e, c) => {
      let split = c.positionals.what.split('/', 3);
      if (split.length == 3) {
        e.nreply(`http://${this.bot.config.help.publicHost}:${this.bot.config.help.publicPort}/${split[0]}#${split[1]}/${split[2]}`);
      } else if (split.length == 2) {
        e.nreply(`http://${this.bot.config.help.publicHost}:${this.bot.config.help.publicPort}/${split[0]}#${split[1]}`);
      } else if (split.length == 1) {
        for (let pname in this.bot.plugins) {
          let plugin = this.bot.plugins[pname];
          if (plugin == undefined) { continue; }
          if (plugin.commands[split[0]]) {
            e.nreply(`http://${this.bot.config.help.publicHost}:${this.bot.config.help.publicPort}/${plugin.name}#${split[0]}`);
            break;
          }
        }
      }
    }).setCooldown(5);

    let key = null;
    let cmdKey = this.newCommand('key');
    cmdKey.addBranch(
      'root',
      '',
      'Generates a random key'
    ).setHandler((e, c) => {
      key = guid();
      this.log.important('Your key: ' + key)
      e.nreply('Done!');
    }).setCooldown(5);
    cmdKey.addBranch(
      'key',
      'key',
      'Gives you admin permissions if the given key is valid'
    ).setHandler((e, c) => {
      if (c.positionals.key == key) {
        key = null;
        this.bot.addGroup(e.sock, e.host, 'admin');
        e.nreply('Done!');
      } else {
        e.nreply('Error: invalid key');
      }
    }).setCooldown(5);

    let cmdRaw = this.newCommand('raw');
    cmdRaw.addBranch(
      'root',
      '...',
      'Sends the given message to the server'
    ).setHandler((e, c) => {
      e.sock.writeq(c.acc);
    });

    let cmdReload = this.newCommand('reload');
    cmdReload.addBranch(
      'root',
      '',
      'Reloads all running plugins'
    ).setHandler((e, c) => {
      this.bot.removeAllListeners();
      this.bot.setupHandlers();
      this.bot.plugins = new Map();
      this.bot.groups = new Map();
      this.bot.setupPluginsAndGroups();
      e.nreply('Done!');
    });

    let cmdJoin = this.newCommand('join');
    cmdJoin.addBranch(
      'targeted',
      'chan =pass',
      'Joins the given channel'
    ).setHandler((e, c) => {
      e.sock.join(c.positionals.chan, c.options.pass);
    });

    let cmdPart = this.newCommand('part');
    cmdPart.addBranch(
      'root',
      '=reason',
      'Parts the current channel'
    ).setHandler((e, c) => {
      e.sock.part(e.target, c.options.reason);
    });
    cmdPart.addBranch(
      'targeted',
      'chan =reason',
      'Parts the current channel'
    ).setHandler((e, c) => {
      e.sock.part(c.positionals.chan, c.options.reason);
    });

    let cmdGroup = this.newCommand('group');
    cmdGroup.addBranch(
      'add',
      '!add user group -raw',
      'Adds the given user (nickname or hostmask (if --raw)) to the given group'
    ).setHandler((e, c) => {
      let host;
      if (c.flags.raw) {
        host = c.positionals.user;
      } else {
        let u = e.sock.userCache.getUser(c.positionals.user);
        host = u.host || c.positionals.user;
      }
      this.bot.addGroup(e.sock, host, c.positionals.group);
      e.nreply(`Added ${host} to the ${c.positionals.group} group`);
    });
    cmdGroup.addBranch(
      'remove',
      '!remove user group -raw',
      'Removes the given user (nickname or hostmask (if --raw)) from the given group'
    ).setHandler((e, c) => {
      let host;
      if (c.flags.raw) {
        host = c.positionals.user;
      } else {
        let u = e.sock.userCache.getUser(c.positionals.user);
        host = u.host || c.positionals.user;
      }
      this.bot.delGroup(e.sock, host, c.positionals.group);
      e.nreply(`Removed ${host} from the ${c.positionals.group} group`);
    });
    cmdGroup.addBranch(
      'check',
      '!check user',
      'Lists user\'s (nickname or hostmask (if --raw)) groups'
    ).setHandler(async (e, c) => {
      let host;
      if (c.flags.raw) {
        host = c.positionals.user;
      } else {
        let u = e.sock.userCache.getUser(c.positionals.user);
        host = u.host || c.positionals.user;
      }
      let groups = await this.bot.getGroups(e.sock, host);
      e.nreply(`${host}\'s groups: ${Array.from(groups).join(', ')}`);
    });

    let cmdFlag = this.newCommand('flag');
    cmdFlag.addBranch(
      'enable',
      '!enable plugin flag',
      'Enables given flag in the current channel'
    ).setHandler((e, c) => {
      let plugin = this.bot.plugins[c.positionals.plugin];
      if (!plugin) {
        e.nreply('Invalid plugin name!');
        return;
      }
      this.bot.setFlag(plugin, e.sock, e.target, c.positionals.flag, true);
      e.nreply('Done!');
    });
    cmdFlag.addBranch(
      'disable',
      '!disable plugin flag',
      'Disables given flag in the current channel'
    ).setHandler((e, c) => {
      let plugin = this.bot.plugins[c.positionals.plugin];
      if (!plugin) {
        e.nreply('Invalid plugin name!');
        return;
      }
      this.bot.setFlag(plugin, e.sock, e.target, c.positionals.flag, false);
      e.nreply('Done!');
    });
    cmdFlag.addBranch(
      'remove',
      '!remove plugin flag',
      'Removes given flag from the current channel'
    ).setHandler((e, c) => {
      let plugin = this.bot.plugins[c.positionals.plugin];
      if (!plugin) {
        e.nreply('Invalid plugin name!');
        return;
      }
      this.bot.removeFlag(plugin, e.sock, e.target, c.positionals.flag);
      e.nreply('Done!');
    });
    cmdFlag.addBranch(
      'check',
      '!check plugin flag',
      'Checks given flag in the current channel'
    ).setHandler(async (e, c) => {
      let plugin = this.bot.plugins[c.positionals.plugin];
      if (!plugin) {
        e.nreply('Invalid plugin name!');
        return;
      }
      let f = await this.bot.getFlag(plugin, e.sock, e.target, c.positionals.flag);
      e.nreply(`${(f == null ? 'undefined' : f).toString()}`);
    });
  }
}
