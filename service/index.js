const util = require('util');
const fs = require('fs');
const readFilePromise = util.promisify(fs.readFile);
const writeFilePromise = util.promisify(fs.writeFile);

const utility = require('./utility');
const Timer = require('./classTimer');
const Burglish = require('./classBurglish');
module.exports = {readFilePromise,writeFilePromise,utility,Timer,Burglish}