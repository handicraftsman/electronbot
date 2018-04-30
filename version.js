const fs = require('fs');
const path = require('path');

let p = path.join(__dirname, 'package.json');
let data = fs.readFileSync(p, 'utf8');

module.exports = JSON.parse(data).version;
