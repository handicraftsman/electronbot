const peg = require('pegjs')

const def = `
command =
  word*

word =
  option
/ flag
/ positional
/ whitespace

nitem =
  val:[^ \\t\\n\\r]+ { return val.join(''); }

onitem =
  val:[^ \\t\\n\\r=]+ { return val.join(''); }

item =
  '"' val:[^"]* '"' { return val.join(''); }
/ "'" val:[^']* "'" { return val.join(''); }
/ val:[^ \\t\\n\\r]+ { return val.join(''); }

whitespace =
  [ \\t\\n\\r]+ { return {type: 'whitespace'}; }

option =
  '--' name:onitem '=' value:item { return {type: 'option', name: name, value: value}; }
/ '-' name:onitem '=' value:item { return {type: 'option', name: name, value: value}; }

flag =
  '--' val:nitem { return {type: 'flag', name: val}; }
/  '-' val:nitem { return {type: 'flag', name: val}; }

positional =
  val:item { return {type: 'positional', value: val}; }
`

var parser = peg.generate(def);

module.exports = (cmd) => {
  ret = {
    options:     {},
    flags:       [],
    positionals: [],
    val:         ''
  };

  ret.val = cmd;
  res = parser.parse(cmd);

  for (let i of res) {
    switch (i.type) {
    case 'flag':
      ret.flags.push(i.name);
      break;
    case 'option':
      ret.options[i.name] = i.value;
      break;
    case 'positional':
      ret.positionals.push(i.value);
      break;
    default: break;
    }
  }

  return ret;
}
