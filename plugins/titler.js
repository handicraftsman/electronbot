module.exports = class extends (require('../Plugin')) {
  constructor(name, bot) {
    super(name, require('../version'), 'The version-resolving plugin', bot);

    this.addHelp('Flags', 'I only work in channels with \'enable-titler\' flag enabled');

    let rgx = /(?:(?:https?):\/\/)(?:\S+(?::\S*)?@)?(?:(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[\/?#]\S*)?/;

    bot.on('privmsg', async (e) => {
      let m = e.message.match(rgx);
      if (!m) { return; }
      let m2 = (e.nick + '!' + e.user + '@' + e.host).match(/bot/);
      if (m2) { return; }
      let f = await this.bot.getFlag(this, e.sock, e.target, 'enable-titler');
      if (!f) { return; }

      require('axios').get(m[0], {timeout: 5000, maxContentLength: 1000000}).then((res) => {
        if (res.headers['content-type'].match(/text\/html/)) {
          let dom = new (require('jsdom').JSDOM)(res.data);
          e.reply(`^ ${dom.window.document.title}`);
        } else {
          e.reply(`^ ${res.headers['content-type']}`);
        }
      }).catch((err) => {
        e.reply(`^ ${err}`);
      })
    });
  }
}
