module.exports = class extends (require('../Plugin')) {
  constructor(name, bot) {
    super(name, require('../version'), 'The channel operator plugin', bot);

    this.newGroup('chanop')
      .addCmd('op', 'self')
      .addCmd('op', 'who')
      .addCmd('deop', 'self')
      .addCmd('deop', 'who')

      .addCmd('hop', 'self')
      .addCmd('hop', 'who')
      .addCmd('dehop', 'self')
      .addCmd('dehop', 'who')

      .addCmd('voice', 'self')
      .addCmd('voice', 'who')
      .addCmd('devoice', 'self')
      .addCmd('devoice', 'who')

      .addCmd('kick', 'who')
      .addCmd('remove', 'who')

      .addCmd('ban', 'who')
      .addCmd('unban', 'who')

      .addCmd('quiet', 'who')
      .addCmd('unquiet', 'who')
      ;

    let cmdOp = this.newCommand('op');
    cmdOp.addBranch('self', '', 'Ops you in the current channel').setHandler((e, c) => {
      e.sock.mode(e.target, `+o ${e.nick}`);
    });
    cmdOp.addBranch('who', 'who', 'Ops given user in the current channel').setHandler((e, c) => {
      e.sock.mode(e.target, `+o ${c.positionals.who}`);
    });
    let cmdDeop = this.newCommand('deop');
    cmdDeop.addBranch('self', '', 'Deops you in the current channel').setHandler((e, c) => {
      e.sock.mode(e.target, `-o ${e.nick}`);
    });
    cmdDeop.addBranch('who', 'who', 'Deops given user in the current channel').setHandler((e, c) => {
      e.sock.mode(e.target, `-o ${c.positionals.who}`);
    });

    let cmdHop = this.newCommand('hop');
    cmdHop.addBranch('self', '', 'Half-ops you in the current channel').setHandler((e, c) => {
      e.sock.mode(e.target, `+h ${e.nick}`);
    });
    cmdHop.addBranch('who', 'who', 'Half-ops given user in the current channel').setHandler((e, c) => {
      e.sock.mode(e.target, `+h ${c.positionals.who}`);
    });
    let cmdDehop = this.newCommand('dehop');
    cmdDehop.addBranch('self', '', 'Dehalf-ops you in the current channel').setHandler((e, c) => {
      e.sock.mode(e.target, `-h ${e.nick}`);
    });
    cmdDehop.addBranch('who', 'who', 'Dehalf-ops given user in the current channel').setHandler((e, c) => {
      e.sock.mode(e.target, `-h ${c.positionals.who}`);
    });

    let cmdVoice = this.newCommand('voice');
    cmdVoice.addBranch('self', '', 'Voices you in the current channel').setHandler((e, c) => {
      e.sock.mode(e.target, `+v ${e.nick}`);
    });
    cmdVoice.addBranch('who', 'who', 'Voices given user in the current channel').setHandler((e, c) => {
      e.sock.mode(e.target, `+v ${c.positionals.who}`);
    });
    let cmdDevoice = this.newCommand('devoice');
    cmdDevoice.addBranch('self', '', 'Devoices you in the current channel').setHandler((e, c) => {
      e.sock.mode(e.target, `-v ${e.nick}`);
    });
    cmdDevoice.addBranch('who', 'who', 'Devoices given user in the current channel').setHandler((e, c) => {
      e.sock.mode(e.target, `-v ${c.positionals.who}`);
    });

    let cmdKick = this.newCommand('kick');
    cmdKick.addBranch('who', 'who -ban =reason', 'Kicks given user from the current channel').setHandler((e, c) => {
      if (c.flags.ban) {
        let u = e.sock.userCache.getUser(c.positionals.who);
        let host = u.host || c.positionals.who;
        e.sock.mode(e.target, `+b ${host}`);
      }
      e.sock.kick(e.target, c.positionals.who, c.options.reason);
    });
    let cmdRemove = this.newCommand('remove');
    cmdRemove.addBranch('who', 'who -ban =reason', 'Removes given user from the current channel').setHandler((e, c) => {
      if (c.flags.ban) {
        let u = e.sock.userCache.getUser(c.positionals.who);
        let host = u.host || c.positionals.who;
        e.sock.mode(e.target, `+b ${host}`);
      }
      e.sock.remove(e.target, c.positionals.who, c.options.reason);
    });

    let cmdBan = this.newCommand('ban');
    cmdBan.addBranch('who', 'who -raw', 'Bans given user (or a raw hostmask) from the current channel').setHandler((e, c) => {
      let host;
      if (c.flags.raw) {
        host = c.positionals.who;
      } else {
        let u = e.sock.userCache.getUser(c.positionals.who);
        host = u.host || c.positionals.who;
      }
      e.sock.mode(e.target, `+b ${host}`);
    });
    let cmdUnban = this.newCommand('unban');
    cmdUnban.addBranch('who', 'who -raw', 'Unbans given user (or a raw hostmask) from the current channel').setHandler((e, c) => {
      let host;
      if (c.flags.raw) {
        host = c.positionals.who;
      } else {
        let u = e.sock.userCache.getUser(c.positionals.who);
        host = u.host || c.positionals.who;
      }
      e.sock.mode(e.target, `-b ${host}`);
    });

    let cmdQuiet = this.newCommand('quiet');
    cmdQuiet.addBranch('who', 'who -raw', 'Quiets given user (or a raw hostmask) in the current channel').setHandler((e, c) => {
      let host;
      if (c.flags.raw) {
        host = c.positionals.who;
      } else {
        let u = e.sock.userCache.getUser(c.positionals.who);
        host = u.host || c.positionals.who;
      }
      e.sock.mode(e.target, `+q ${host}`);
    });
    let cmdUnquiet = this.newCommand('unquiet');
    cmdUnquiet.addBranch('who', 'who -raw', 'Unquiets given user (or a raw hostmask) in the current channel').setHandler((e, c) => {
      let host;
      if (c.flags.raw) {
        host = c.positionals.who;
      } else {
        let u = e.sock.userCache.getUser(c.positionals.who);
        host = u.host || c.positionals.who;
      }
      e.sock.mode(e.target, `-q ${host}`);
    });

  }
}
