// process.env.PORT
// process.env.HOST

const express = require('express');
const path = require('path');
const serveStatic = require('serve-static');

module.exports = async (bot) => {
  this.config = bot.config.help || {};
  this.config.publicHost = this.config.publicHost || process.env.HOST || 'localhost';
  this.config.publicPort = parseInt(this.config.publicPort || process.env.PORT || '8080');
  this.config.port = process.env.PORT || this.config.publicPort;

  var logger = require('./newLog')('help');
  var helpServer = express();

  helpServer.set('view engine', 'pug')
  helpServer.set('views', path.join(__dirname, 'public'));

  helpServer.use('/static/mdl', serveStatic(path.join(require.resolve('material-design-lite').match(/^.*[\/\\]node_modules[\/\\][^\/\\]*/)[0], 'dist')));

  helpServer.get('/', (req, res) => {
    res.render('index', { req: req, res: res, bot: bot });
  });

  helpServer.get('/:plugin', (req, res) => {
    if (bot.plugins[req.params.plugin] == undefined) {
      res.send('Cannot find such plugin!');
    }
    res.render('plugin', { req: req, res: res, bot: bot, pname: req.params.plugin });
  });

  helpServer.listen(this.config.publicPort, () => {
    logger.important(`Serving help on http://${this.config.publicHost}:${this.config.publicPort}`);
  });

  return helpServer;
};
