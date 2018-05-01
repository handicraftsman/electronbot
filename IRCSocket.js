const util = require('util');
const net = require('net');
const tls = require('tls');
const readline = require('readline');
const fs = require('fs');

rgxAddress = /^(.+?)(?:\/(\+)?(\d{1,5}))?$/;

function parseAddress(addr) {
  var md = addr.match(rgxAddress);
  return { 'str': addr, 'host': md[1], 'port': parseInt(md[3]) || 6667, 'ssl': md[2] === '+' }
}

module.exports = class {
  constructor(name, bot) {
    this.log = require('./newLog')(`!${name}`);
    this.log.important('Hello, IRC!');

    this.name = name;
    this.bot  = bot;

    this.addresses = [];
    this.addrId = 0;

    this.config = this.bot.config.servers[name];
    for (var addr of this.config.addresses) {
      this.addresses.push(parseAddress(addr));
    }

    this.auth = this.config.auth;
    this.log.info(`Using '${this.auth.type}' authentication`);

    this.lastWrite = new Date();
    this.lastCleanup = new Date();
    this.queue = [];
    this.burst = 0;
    this.userCache = new (require('./UserCache'))(this);
  }

  [util.inspect.custom]() {
    return `<IRCSocket ${this.name}>`;
  }

  nextAddr() {
    let addr = this.addresses[this.addrId];
    this.addrId = this.addrId + 1;
    if (this.addrId == this.addresses.length) { this.addrId = 0; }
    return addr;
  }

  write(msg) {
    let s = this.sock;
    s.write(msg + '\r\n');
    this.log.irc(`W> ${msg}`);
  }

  writeq(msg) {
    this.queue.push(msg);
  }

  setupHandlers(sock) {
    if (!sock) { return; }

    sock.on('error', (e) => {
      console.dir(e);
      this.bot.emit('disconnect', {sock: this});
    });

    sock.rl.on('line', (l) => {
      this.log.irc(`R> ${l}`);
      this.bot.emit('message', {sock: this, msg: l});
    });

    sock.rl.on('close', () => {
      sock.rl.close();
      this.bot.emit('disconnect', {sock: this});
    });
  }

  async connect() {
    let addr = this.nextAddr();
    this.log.important(`Connecting to ${addr.str}`);

    let connHandler = () => {
      this.queue = [];
      this.userCache.clear();
      this.bot.emit('connect', {sock: this});
      this.authenticate();
    };

    if (addr.ssl) {
      if (this.config.cert && this.config.key) {
        let ctx = tls.createSecureContext({
          cert: fs.readFileSync(this.config.cert),
          key: fs.readFileSync(this.config.key)
        });
        this.sock = tls.connect({host: addr.host, port: addr.port, secureContext: ctx}, connHandler);
      } else {
        this.sock = tls.connect({host: addr.host, port: addr.port}, connHandler);
      }
    } else {
      this.sock = new net.Socket();
      this.sock.connect({host: addr.host, port: addr.port}, connHandler);
    }

    this.sock.rl = readline.createInterface({ input: this.sock });

    this.setupHandlers(this.sock);

    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1));
      let cur = new Date();
      if (this.burst < 5 || cur - this.lastWrite >= 700) {
        let msg;
        if (msg = this.queue.pop()) {
          this.write(msg);
          this.lastWrite = cur;
          if (this.burst < 5) { this.burst++; }
        }
      }
      if (cur - this.lastWrite >= 1400) {
        this.burst = 0;
      }
      if (cur - this.lastCleanup >= 3600000) {
        this.userCache.cleanup();
      }
    }
  }

  authenticate() {
    if (this.config.auth.type == 'pass') {
      this.write(`PASS ${this.config.auth.pass}`);
    }
    this.write(`NICK ${this.config.nick}`);
    this.write(`USER ${this.config.user} 0 * :${this.config.rnam}`)
  }

  join(chan, pass) {
    if (pass) {
      this.writeq(`JOIN ${chan} ${pass}`);
    } else {
      this.writeq(`JOIN ${chan}`);
    }
  }

  part(chan, reason = 'Bye!') {
    this.writeq(`PART ${chan} :${reason}`);
  }

  format(message) {
    return message
      .replace(/[\r\n\t ]+/g, ' ')
      .replace(/%C%/g,        '%C?')
      .replace(/\,%/g,        ',?')
      .replace(/%C/g,         '\x03')
      .replace(/%B/g,         '\x02')
      .replace(/%I/g,         '\x10')
      .replace(/%U/g,         '\x1F')
      .replace(/%N/g,         '\x0F')
      .replace(/\?WHITE/g,    '0')
      .replace(/\?BLACK/g,    '1')
      .replace(/\?BLUE/g,     '2')
      .replace(/\?GREEN/g,    '3')
      .replace(/\?RED/g,      '4')
      .replace(/\?BROWN/g,    '5')
      .replace(/\?PURPLE/g,   '6')
      .replace(/\?ORANGE/g,   '7')
      .replace(/\?YELLOW/g,   '8')
      .replace(/\?LGREEN/g,   '9')
      .replace(/\?CYAN/g  ,   '10')
      .replace(/\?LCYAN/g,    '11')
      .replace(/\?LBLUE/g,    '12')
      .replace(/\?PINK/g,     '13')
      .replace(/\?GREY/g,     '14')
      .replace(/\?LGREY/g,    '15');
  }

  privmsg(target, message) {
    message = this.format(message);
    for (var l of message.match(/.{0,400}/g)) {
      if (l.trim() != '') {
        this.writeq(`PRIVMSG ${target} :${l}`);
      }
    }
  }

  ctcp(target, message) {
    this.privmsg(target, `\x01${message}\x01`);
  }

  action(target, message) {
    this.ctcp(target, `ACTION ${message}`);
  }

  notice(target, message) {
    message = this.format(message);
    for (var l of message.match(/.{0,400}/g)) {
      if (l.trim() != '') {
        this.writeq(`NOTICE ${target} :${l}`);
      }
    }
  }

  nctcp(target, message) {
    this.notice(target, `\x01${message}\x01`);
  }

  nick(newNick) {
    this.writeq(`NICK ${newNick}`);
  }

  kick(chan, nick, reason = 'Bye!') {
    this.writeq(`KICK ${chan} ${nick} :${reason}`);
  }

  remove(chan, nick, reason = 'Bye!') {
    this.writeq(`REMOVE ${chan} ${nick} :${reason}`);
  }

  mode(chan, args) {
    this.writeq(`MODE ${chan} ${args}`);
  }
}
