module.exports = (branch, cmd) => {
  var res = {
    positionals: {},
    flags:       {},
    options:     {},
    acc:         ''
  };

  if (branch.accumulate) {
    if (branch.specifiers.length + branch.positionals.length + branch.flags.length + branch.options.length == 0) {
      res.acc = cmd.val;
      return res;
    }

    if (branch.specifiers.length + branch.positionals.length > cmd.positionals.length) {
      return null;
    }
  } else if (branch.specifiers.length + branch.positionals.length != cmd.positionals.length) {
    return null;
  }

  for (let i of cmd.flags) {
    if (!branch.flags.includes(i)) {
      return null;
    }
  }

  for (let i of branch.flags) {
    res.flags[i] = cmd.flags.includes(i);
  }

  for (let i in cmd.options) {
    if (!branch.options.includes(i)) {
      return null;
    }
    res.options[i] = cmd.options[i];
  }

  for (let i in branch.specifiers) {
    if (branch.specifiers[i] != cmd.positionals[i]) {
      return null;
    }
  }

  for (let i in branch.positionals) {
    let p = cmd.positionals.slice(branch.specifiers.length);
    res.positionals[branch.positionals[i]] = p[i];
  }

  if (branch.accumulate) {
    acc = ''
    for (i = branch.specifiers.length + branch.positionals.length; i < cmd.positionals.length; ++i) {
      acc += cmd.positionals[i] + ' ';
    }
    acc = acc.slice(0, acc.length-1);
    res.acc = acc;
  }

  return res;
}
