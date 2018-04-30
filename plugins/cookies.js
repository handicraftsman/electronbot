module.exports = class extends (require('../Plugin')) {
  constructor(name, bot) {
    super(name, require('../version'), 'The cookie giveaway plugin', bot);

    this.addHelp('Flags', 'All commands listed below only work in channels with \'enable-cookies\' flag enabled');

    this.newGroup('world')
      .addCmd('cookie', 'root')
      .addCmd('cookie', 'targeted')
      ;

    const cookie_qualities = {
      normal: '',
      uncommon: '%C%LBLUEuncommon ',
      rare: '%C%BLUErare ',
      epic: '%C%PURPLEepic ',
      legendary: '%C%YELLOWlegendary ',
      holy: '%C%ORANGEholy ',
      hitech: '%C%CYANhi-tech ',
      quantum: '%C%LBLUEquantum ',
      evil: '%C%BLACKevil ',
      magical: '%C%PURPLEmagical ',
      ancient: '%C%LBLUEancient ',
      vampiric: '%C%REDvampiric ',
    };

    const cookie_types = {
      normal: '',

      blazing: '%C%ORANGEblazing ',
      hot: '%C%REDhot ',

      frost: '%C%CYANfrost ',
      chilling: '%C%LBLUEchilling ',

      shocking: '%C%YELLOWshocking ',
      aerial: '%C%LGREYaerial ',

      stone: '%C%GREYstone ',
      mud: '%C%BROWNmud ',

      void: '%C%BLACKvoid ',
      ghostly: '%C%WHITEghostly ',
      bloody: '%C%REDbloody ',
      nyan: '%C%REDn%C%GREENy%C%BLUEa%C%CYANn ',
      teleporting: '%C%CYANteleporting ',
      wild: '%C%BROWNwild ',
      alien: '%C%GREENalien ',
      spacious: '%C%BLACKspacious ',
      atomic: '%C%REDatomic ',
      chocolate: '%C%BROWNchocolate ',
    };

    this.commands.cookie = this.newCommand('cookie');
    this.commands.cookie.addBranch(
      'root',
      '=quality =type',
      'Gives a cookie to the invoker'
    ).setHandler((e, c) => {
      this.bot.getFlag(this, e.sock, e.target, 'enable-cookies').then((isEnabled) => {
        if (!isEnabled) { return };
        var quality = c.options.quality || Object.keys(cookie_qualities)[Math.floor(Math.random()*Object.keys(cookie_qualities).length)];
        var type = c.options.type || Object.keys(cookie_types)[Math.floor(Math.random()*Object.keys(cookie_types).length)];
        e.sock.action(e.replyTo, `%Ngives %B${e.nick}%N a %B${cookie_qualities[quality] || ''}${cookie_types[type] || ''}%C%BROWNcookie%N`)
      });
    }).setCooldown(10);
    this.commands.cookie.addBranch(
      'targeted',
      'who =quality =type',
      'Gives a cookie to the given user'
    ).setHandler((e, c) => {
      this.bot.getFlag(this, e.sock, e.target, 'enable-cookies').then((isEnabled) => {
        if (!isEnabled) { return };
        var quality = c.options.quality || Object.keys(cookie_qualities)[Math.floor(Math.random()*Object.keys(cookie_qualities).length)];
        var type = c.options.type || Object.keys(cookie_types)[Math.floor(Math.random()*Object.keys(cookie_types).length)];
        e.sock.action(e.replyTo, `%Ngives %B${c.positionals.who}%N a %B${cookie_qualities[quality] || ''}${cookie_types[type] || ''}%C%BROWNcookie%N`)
      });
    }).setCooldown(10);
  }
}
