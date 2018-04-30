const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

const lvls = {
  levels: {
    critical: 0,
    important: 1,
    error: 2,
    warning: 3,
    info: 4,
    irc: 5,
    debug: 7
  }
};

const fmt = printf(info => {
  return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`;
});

module.exports = (lbl) => {
  var logger = createLogger({
    level: 'debug',
    levels: lvls.levels,
    format: combine(label({ label: lbl }), timestamp(), fmt),
    transports: [
      new transports.Console({ colorize: true })
    ]
  });
  return logger;
}