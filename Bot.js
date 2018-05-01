const fs = require('fs');
const path = require('path');
const util = require('util');
const events = require('events');

const IRCSocket = require('./IRCSocket');

/*
 * These events are supported
 * connect: sock
 * disconnect: sock
 * message: sock, msg
 * code_???: sock, extra
 * ping: sock, target
 * join: sock, nick, user, host, chan
 * part: sock, nick, user, host, chan, reason
 * quit: sock, nick, user, host, reason
 * privmsg: sock, nick, user, host, target, message
 */

process.on('uncaughtException', function(err) {
  console.log(err);
});

process.on('unhandledRejection', function(err) {
  console.log(err);
})

module.exports = class extends events.EventEmitter {
  constructor({configPath = './electronbot.json', dbPath = './electronbot.db', searchdir = './'}, doneCallback) {
    super();

    process.on('uncaughtException', function(err) {
      console.dir(err)
    })

    this.configPath = configPath;
    this.dbPath     = dbPath;
    this.searchdir  = searchdir;

    this.log = require('./newLog')('bot');
    this.log.important('Hello, World!');

    /*
     * Load config
     */
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    this.config.name = this.config.name || 'ElectronBot';
    this.config.prefix = this.config.prefix || '!';
    this.config.nick = this.config.nick || 'ElectronBot';
    this.config.user = this.config.user || undefined;
    this.config.rnam = this.config.rnam || 'An IRC bot in node.js';
    this.config.servers = this.config.servers || {};
    for (let sname in this.config.servers) {
      let server = this.config.servers[sname];
      server.prefix = server.prefix || this.config.prefix
      server.nick = server.nick || this.config.nick;
      server.user = server.user || server.nick || this.config.user;
      server.rnam = server.rnam || this.config.rnam;
      if (typeof(server.auth) == 'string') {
        server.auth = {
          'type': 'pass',
          'pass': server.auth
        };
      }
      server.auth = server.auth || { 'type': 'none' };
      server.autojoin = server.autojoin || [];
    };
    this.config.plugins = this.config.plugins || [];
    this.config.groups = this.config.groups || {};

    /*
     * Setup the bot itself
     */

    this.setupPluginsAndGroups();

    this.sockets = new Map();
    for (let sname in this.config.servers) {
      let server = this.config.servers[sname];
      this.sockets[sname] = new IRCSocket(sname, this);
    }

    /*
     * Load database
     */
    this.db = new (require('sqlite3').Database)(this.dbPath);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS groupinfo (
        server VARCHAR(64),
        host VARCHAR(64),
        name VARCHAR(64),
        PRIMARY KEY(server, host, name)
      );
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS flags (
        plugin VARCHAR(64),
        server VARCHAR(64),
        channel VARCHAR(64),
        name VARCHAR(64),
        value BOOLEAN,
        PRIMARY KEY(plugin, server, channel, name)
      );
    `);
    if (doneCallback) { doneCallback(this) }
  }

  [util.inspect.custom]() {
    return `<Bot>`;
  }

  setupPluginsAndGroups() {
    this.plugins = new Map();
    let plist = this.config.plugins;
    this.config.plugins = new Set();
    this.config.plugins.add('./plugins/core');
    for (let pname of plist) { this.config.plugins.add(pname); }
    for (let pname of this.config.plugins.values()) {
      pname = pname.replace(/@/, this.searchdir);
      delete require.cache[require.resolve(pname)];
      this.plugins[path.basename(pname)] = new (require(require.resolve(pname, {
        paths: [this.searchdir, __dirname]
      })))(path.basename(pname), this);
    }

    this.groups = new Map();
    for (let gname in this.config.groups) {
      if (gname.match(/\//)) {
        throw `${gname} group is namespaced`;
      }
      this.log.debug(`groups <- ${gname}`);
      let g = this.config.groups[gname];
      let og = new Set();
      g.perms = g.perms || [];
      for (let p of g.perms) {
        og.add(p);
        this.log.debug(`groups[${gname}] <- ${p}`);
      }
      g.include = g.include || [];
      for (let ign of g.include) {
        this.log.debug(`groups[${gname}] <<- ${ign}`);
        let m = ign.split('/');
        if (m.length == 1) {
          let ig = this.groups[ign] || (new Set());
          for (let p of ig) {
            og.add(p);
            this.log.debug(`groups[${gname}] <- ${p}`);
          }
        } else {
          if (this.plugins[m[0]]) {
            let plg = this.plugins[m[0]];
            let ig = this.plugins[m[0]].groups[m[1]] || (new Set());
            for (let p of ig) {
              og.add(p);
              this.log.debug(`groups[${gname}] <- ${p}`);
            }
          } else {
            this.log.warning(`No such plugin: ${m[0]}`);
          }
        }
        // todo - resolve group and do stuff
      }
      this.groups[gname] = og;
    }
    this.groups.world = this.groups.world || new Set();
    this.groups.admin = this.groups.admin || new Set();
  }

  setupHandlers() {
    this.on('connect', ({sock}) => {
      sock.log.important('Connected!');
    });

    this.on('disconnect', async ({sock}) => {
      sock.log.important('Disconnected! Reconnecting after 5 seconds');
      await new Promise(resolve => setTimeout(resolve, 5 * 1000));
      sock.connect();
    });

    const rgxPrivmsg = /^:(.+?)!(.+?)@(.+?) PRIVMSG (.+?) :(.+)$/;
    const rgxPing = /^PING :(.+)$/;
    const rgxCode = /^:.+? (\d\d\d) .+? (.+)$/;
    const rgxJoin = /^:(.+?)!(.+?)@(.+?) JOIN (.+)$/;
    const rgxPart = /^:(.+?)!(.+?)@(.+?) PART (.+?) :(.+)$/;
    const rgxNick = /^:(.+?)!(.+?)@(.+?) NICK :(.+)$/;
    const rgxQuit = /^:(.+?)!(.+?)@(.+?) QUIT :(.+)$/;

    this.on('message', ({sock, msg}) => {
      let m;
      if (m = msg.match(rgxPrivmsg)) {
        this.emit('privmsg', {
          sock: sock,
          nick: m[1],
          user: m[2],
          host: m[3],
          target: m[4],
          message: m[5],
          reply: (msg) => {
            let replyTo = (m[4] == sock.config.nick) ? m[1] : m[4];
            sock.privmsg(replyTo, msg);
          },
          nreply: (msg) => {
            sock.notice(m[1], msg);
          },
          replyTo: (m[4] == sock.config.nick) ? m[1] : m[4]
        });
      } else if (m = msg.match(rgxPing)) {
        this.emit('ping', {sock: sock, target: m[1]});
      } else if (m = msg.match(rgxCode)) {
        this.emit(`code_${m[1]}`, {sock: sock, extra: m[2]});
      } else if (m = msg.match(rgxJoin)) {
        this.emit('join', {sock: sock, nick: m[1], user: m[2], host: m[3], chan: m[4]});
      } else if (m = msg.match(rgxPart)) {
        this.emit('part', {sock: sock, nick: m[1], user: m[2], host: m[3], chan: m[4], reason: m[5]});
      } else if (m = msg.match(rgxNick)) {
        this.emit('nick', {sock: sock, nick: m[1], user: m[2], host: m[3], newNick: m[4]});
      } else if (m = msg.match(rgxQuit)) {
        this.emit('quit', {sock: sock, nick: m[1], user: m[2], host: m[3], reason: m[4]});
      }
    });

    this.on('ping', ({sock, target}) => {
      sock.write(`PONG :${target}`);
    });

    this.on('code_001', ({sock, extra}) => {
      sock.log.important('In IRC!');
      for (let chan of sock.config.autojoin) {
        sock.join(chan);
      }
    });

    this.on('code_352', ({sock, extra}) => {
      var r = /^(.+?) (.+?) (.+?) .+? (.+?) .+$/;
      let m;
      if (m = extra.match(r)) {
        sock.userCache.joinUser(m[4], m[2], m[3], m[1]);
      }
    });

    this.on('join', ({sock, nick, user, host, chan}) => {
      sock.userCache.joinUser(nick, user, host, chan);
      if (nick == sock.config.nick) {
        sock.writeq(`WHO ${chan}`);
      }
    });

    this.on('part', ({sock, nick, user, host, chan, reason}) => {
      sock.userCache.partUser(nick, user, host, chan);
    });

    this.on('quit', ({sock, nick, user, host}) => {
      sock.userCache.quitUser(nick, user, host);
    });

    this.on('nick', ({sock, nick, user, host, newNick}) => {
      sock.userCache.nickUser(nick, user, host, newNick);
      if (nick == sock.config.nick) { sock.config.nick = newNick; }
    });

    this.on('privmsg', (e) => {
      if (e.message.slice(0, e.sock.config.prefix.length) == e.sock.config.prefix) {
        let split = e.message.slice(e.sock.config.prefix.length).split(' ');
        let dat = split.slice(1).join(' ');
        let c = split[0];
        let cs = c.split('/');
        if (cs.length == 3) {
          this.emit('command', {
            sock: e.sock,
            raw: dat,
            cPlugin: cs[0],
            cCommand: cs[1],
            cBranch: cs[2],
            reply: e.reply,
            nreply: e.nreply,
            replyTo: e.replyTo,
            nick: e.nick,
            user: e.user,
            host: e.host,
            target: e.target
          });
        } else if (cs.length == 2) {
          this.emit('command', {
            sock: e.sock,
            raw: dat,
            cPlugin: cs[0],
            cCommand: cs[1],
            cBranch: undefined,
            reply: e.reply,
            nreply: e.nreply,
            replyTo: e.replyTo,
            nick: e.nick,
            user: e.user,
            host: e.host,
            target: e.target
          });
        } else if (cs.length == 1) {
          this.emit('command', {
            sock: e.sock,
            raw: dat,
            cPlugin: undefined,
            cCommand: cs[0],
            cBranch: undefined,
            reply: e.reply,
            nreply: e.nreply,
            replyTo: e.replyTo,
            nick: e.nick,
            user: e.user,
            host: e.host,
            target: e.target
          });
        }
      }
    });

    this.on('command', (e) => {
      if (e.cPlugin && e.cCommand && e.cBranch) {
        this.emit('command3', e);
      } else if (e.cPlugin && e.cCommand) {
        this.emit('command2', e);
      } else if (e.cCommand) {
        this.emit('command1', e);
      }
    });

    let canUseCommand = async (e, m, plugin, command, branch) => {
      let hp = await this.hasPerm(e.sock, e.host, `${plugin.name}/${command.name}/${branch.name}`);
      if (!hp) { return false; }
      if (branch.cooldown == 0) { return true; }
      if (branch.lastUse[e.sock.name] == undefined) {
        branch.lastUse[e.sock.name] = new Map();
        branch.lastUse[e.sock.name][e.target] = new Map();
        branch.lastUse[e.sock.name][e.target][e.host] = new Date();
        return true;
      } else if (branch.lastUse[e.sock.name][e.target] == undefined) {
        branch.lastUse[e.sock.name][e.target] = new Map();
        branch.lastUse[e.sock.name][e.target][e.host] = new Date();
        return true;
      } else if (branch.lastUse[e.sock.name][e.target][e.host] == undefined) {
        branch.lastUse[e.sock.name][e.target][e.host] = new Date();
        return true;
      } else {
        let cur = new Date();
        if (cur - branch.lastUse[e.sock.name][e.target][e.host] >= (branch.cooldown * 1000)) {
          branch.lastUse[e.sock.name][e.target][e.host] = cur;
          return true;
        } else {
          return false;
        }
      }
    }

    this.on('command3', async (e) => {
      let plugin = this.plugins[e.cPlugin];
      if (plugin == undefined) { return; }
      let command = plugin.commands[e.cCommand];
      if (command == undefined) { return; }
      let branch = command.branches[e.cBranch];
      if (branch == undefined) { return; }
      let m = require('./matchCommand')(branch, require('./parseCommand')(e.raw));
      if (m != null && branch.handler != undefined) {
        if (await canUseCommand(e, m, plugin, command, branch)) { branch.handler(e, m); }
      }
    });

    this.on('command2', async (e) => {
      let plugin = this.plugins[e.cPlugin];
      if (plugin == undefined) { return; }
      let command = plugin.commands[e.cCommand];
      if (command == undefined) { return; }
      for (let bname in command.branches) {
        let branch = command.branches[bname]
        let m = require('./matchCommand')(branch, require('./parseCommand')(e.raw));
        if (m != null && branch.handler != undefined) {
          e.cBranch = bname;
          if (await canUseCommand(e, m, plugin, command, branch)) { branch.handler(e, m); }
        }
      }
    });

    this.on('command1', async (e) => {
      for (let pname in this.plugins) {
        let plugin = this.plugins[pname];
        let command = plugin.commands[e.cCommand];
        if (command == undefined) { continue; }
        for (let bname in command.branches) {
          let branch = command.branches[bname];
          let m = require('./matchCommand')(branch, require('./parseCommand')(e.raw));
          if (m != null && branch.handler != undefined) {
            e.cPlugin = pname;
            e.cBranch = bname;
            if (await canUseCommand(e, m, plugin, command, branch)) { branch.handler(e, m); }
          }
        }
      }
    })

  }

  async start() {
    this.setupHandlers();

    require('./runHelpServer')(this);
    for (let sname in this.sockets) {
      let socket = this.sockets[sname];
      socket.connect();
    }
  }

  async getFlag(plugin, sock, channel, name) {
    let f = await new Promise((resolve, reject) => {
      try {
        this.db.get(
          'SELECT value FROM flags WHERE plugin=? AND server=? AND channel=? AND name=?;',
          [plugin.name, sock.name, channel, name],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      } catch (e) {
        reject(e);
      }
    });
    if (f) {
      return f.value == 1 ? true : false;
    } else {
      return null;
    }
  }

  async setFlag(plugin, sock, channel, name, value) {
    let f = await new Promise((resolve, reject) => {
      try {
        this.db.get(
          'SELECT EXISTS(SELECT value FROM flags WHERE plugin=? AND server=? AND channel=? AND name=?);',
          [plugin.name, sock.name, channel, name],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      } catch (e) {
        reject(err);
      }
    });
    if (f[Object.keys(f)[0]] == 1) {
      this.db.run(
        'UPDATE flags SET value=? WHERE plugin=? AND server=? AND channel=? AND name=?;',
        [value, plugin.name, sock.name, channel, name]
      );
    } else {
      this.db.run(
        'INSERT INTO flags (plugin, server, channel, name, value) VALUES (?, ?, ?, ?, ?);',
        [plugin.name, sock.name, channel, name, value]
      );
    }
  }

  async removeFlag(plugin, sock, channel, name) {
    this.db.run(
      'DELETE FROM flags WHERE plugin=? AND server=? AND channel=? AND name=?',
      [plugin.name, sock.name, channel, name]
    );
  }

  // todo
  async hasPerm(sock, host, perm) {
    let groups = await new Promise((resolve, reject) => {
      try {
        this.db.all(
          'SELECT name FROM groupinfo WHERE server=? AND host=?;',
          [sock.name, host],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      } catch (e) {
        reject(err);
      }
    });
    groups = new Set(groups.map((x) => {
      return x.name;
    }));
    groups.add('world');
    for (let gname of groups.values()) {
      if (!gname) { continue; }
      let s = gname.split('/', 2);
      if (s.length == 1) {
        for (let p of this.groups[gname]) {
          if (p == perm) { return true; }
        }
      } else if (s.length == 2) {
        let plugin = this.plugins[s[0]];
        if (plugin == undefined) { continue; }
        for (let perm of plugin.groups) {
          if (p == perm) { return true; }
        }
      }
    }
    return false;
  }

  async addGroup(sock, host, group) {
    let f = await new Promise((resolve, reject) => {
      try {
        this.db.all(
          'SELECT * FROM groupinfo WHERE server=? AND host=? AND name=? LIMIT 1;',
          [sock.name, host, group],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      } catch (e) {
        reject(err);
      }
    });
    if (f.length == 0) {
      this.db.run(
        'INSERT INTO groupinfo (server, host, name) VALUES (?, ?, ?);',
        [sock.name, host, group]
      );
    }
  }

  async delGroup(sock, host, group) {
    this.db.run(
      'DELETE FROM groupinfo WHERE server=? AND host=? AND name=?',
      [sock.name, host, group]
    );
  }

  async getGroups(sock, host) {
    let groups = await new Promise((resolve, reject) => {
      try {
        this.db.all(
          'SELECT name FROM groupinfo WHERE server=? AND host=?;',
          [sock.name, host],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      } catch (e) {
        reject(err);
      }
    });
    groups = new Set(groups.map((x) => {
      return x.name;
    }));
    return groups;
  }
}
