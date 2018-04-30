module.exports = class {
  constructor(sock) {
    this.log = require('./newLog')(`@${sock.name}-usercache`);
    this.store = new Map();
  }

  clear() {
    this.store = {};
  }

  cleanup() {
    for (let nick in this.store) {
      let u = this.store[nick];
      if (u.chans.size == 0) { delete this.store[nick]; }
    }
  }

  getUser(nick) {
    return this.store[nick] || { nick: nick, chans: new Set() };
  }

  setUser(nick, u) {
    this.store[nick] = u;
  }

  removeUser(nick) {
    delete this.store[nick];
  }

  joinUser(nick, user, host, chan) {
    let u = this.getUser(nick);
    u.user = user;
    u.host = host;
    u.chans.add(chan);
    this.setUser(nick, u);
  }

  partUser(nick, user, host, chan) {
    let u = this.getUser(nick);
    u.user = user;
    u.host = host;
    u.chans.delete(chan);
    if (u.chans.size == 0) {
      this.removeUser(nick);
    }
    this.setUser(nick, u);
  }

  nickUser(nick, user, host, newNick) {
    this.store[newNick] = this.store[nick];
    delete this.store[nick];
    this.store[newNick].nick = newNick;
  }

  quitUser(nick, user, host) {
    this.removeUser(nick);
  }
}
