const path = require("path");
// const url = require('url');
// const http = require('http');
// const https = require('https');

const fs = require('fs');
const dotenv = require("dotenv");

const config = require("./config");
const {utility,Timer,Burglish,readFilePromise,writeFilePromise} = require("./service");

const rootCommon = process.mainModule.paths[0].split('node_modules')[0].slice(0, -1);

async function environmentInitiate() {
  try {
    const env = await requestEnvironment(rootCommon);
    const _allowed = Object.keys(config.environment);
    Object.assign(
      config.common,
      Object.keys(env).filter(
        e => !_allowed.includes(e)
      ).reduce(
        (o, i) => Object.assign(({[i]: env[i]}),o), {}
      )
    );
    // if (env.virtual) {
    //   env.virtual = await virtualData(utility.hack.env(env.virtual));
    //   config.proxy.single = false;
    // } else {
    //   env.virtual = await virtualData({'':null});
    // }

    env.virtual = await virtualData();
    Object.assign(config.environment, env);
  } catch (e) {
    throw e;
  }
}

async function requestEnvironment(dir) {
  return await readFilePromise(path.resolve(dir, config.env)).then(i=>dotenv.parse(Buffer.from(i))).catch(()=>new Object());
}

async function virtualData() {
  var rootDir = path.resolve(rootCommon);
  var starterMain = path.resolve(rootDir, config.starter.main);
  var starterCommand = path.resolve(rootDir, config.starter.command);
  if (fs.existsSync(starterMain)){
    var package = require(path.resolve(rootDir,'package.json'));
    var environments = {};
    environments.description = package.description;
    environments.version = package.version;
    // environments.version = package.version;
    // environments.development = process.env.NODE_ENV && process.env.NODE_ENV == 'production';
    environments.development = !process.env.NODE_ENV || process.env.NODE_ENV.trim() != 'production';

    // console.log(process.env)

    var user = {
      starterMain:starterMain,
      starterCommand:fs.existsSync(starterCommand)?starterCommand:null
    };

    user.Config = Object.assign({
      name:null,
      dir:{
        root:rootDir,
        static: path.resolve(rootDir,config.directory.static),
        assets: path.resolve(rootDir,config.directory.assets),
        views: path.resolve(rootDir,config.directory.views),
        routes: path.resolve(rootDir,config.directory.routes)
      }
    }, config.common);

    var starterConfig = path.resolve(rootDir,config.starter.config);
    if (fs.existsSync(starterConfig)) {
      try {
        const {config} = require(starterConfig);
        if (config instanceof Object) Object.assign(environments, config);
      } catch (error) {
        throw error;
      }
    }


    if (environments.referer){
      environments.referer = utility.arrays.unique(environments.referer.split(',')).map(utility.hack.regex);
    } else if (typeof config.common.referer == 'string') {
      environments.referer = utility.arrays.unique(config.common.referer.split(',')).map(utility.hack.regex);
    }

    if (environments.restrict){
      environments.restrict = utility.hack.env(environments.restrict);
    } else if (typeof config.common.restrict == 'string') {
      environments.restrict = utility.hack.env(config.common.restrict);
    }

    Object.assign(user.Config, environments);

    return user;
  } else {
    throw 'No Starter';
  }
}

// exports.root=rootCommon;
exports.utility=utility;
exports.readFilePromise=readFilePromise;
exports.writeFilePromise=writeFilePromise;
exports.Timer=Timer;
exports.Burglish=Burglish;

exports.environment = () => config.environment;

// NOTE: to remove
// exports.fs=fs;
// exports.path=path;

exports.command = async function(){
  try {
    await environmentInitiate();
    return await require('./cli')();
  } catch (e) {
    throw e
  }
}

exports.server = async function(){
  try {
    await environmentInitiate();
    await require('./gui')();
    return `${config.environment.virtual.Config.name} ${config.environment.LISTEN || '*'}:${config.environment.PORT}`;
  } catch (e) {
    throw e
  } finally {
    for (const e of ['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM', 'uncaughtException']) process.on(e, exitHandler.bind(null, {exit:true}));
  }
}

function exitHandler() {
  hitCounter();
  process.exit();
}
function hitCounter() {
  var id = new Date().getTime();
  const {Config} = config.environment.virtual;
  if (!Config.hasOwnProperty('visits')) return;
  if (!Config.visits.hasOwnProperty('counts') || Config.visits.counts <= 0) return;
  try {
    if (Config.visits.log) fs.appendFileSync(Config.visits.log, `${id}:${Config.visits.counts}\r\n`);
    Config.visits.counts = 0;
  } catch (error) {
    throw error;
  }
}
// var counter = JSON.parse(fs.readFileSync(file));
// if (!counter.hasOwnProperty('req')){
//   counter.req=[];
// }
// counter.req.push({i:id,v:counts});
// fs.writeFileSync(file, JSON.stringify(counter));
// appendFileSync
// fs.appendFile(file, `${id}:${counts}`, function (err) {
//   if (err) throw err;
//   // console.log('Saved!');
//   config.environment.virtual.Config.visitsCounter = 0;
// });