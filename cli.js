const fs = require('fs');
const path = require("path");

const config = require("./config");
const database = require("./database");
const service = require("./service");

var userParam = process.argv.splice(2);

function requestStarter(src){
  // if (fs.existsSync(src)) return require(src);
  fs.stat(src, function(err, stat) {
    if (!err) require(src);
  });
}

async function commandInitiate(user){
  const app = require(user.starterMain);
  app.Config = user.Config;
  app.Param = userParam;

  // NOTE: initiator if only exists!
  requestStarter(path.resolve(user.Config.dir.root,config.starter.initiator));
  // app.sql = new database.mysql(app.Config);
  // if (app.sql.url) {
  //   await app.sql.handleDisconnect().catch(e=>{throw e});
  // }
  // app.mongo = new database.mongo(app.Config);
  // if (app.mongo.url) {
  //   await app.mongo.connect().catch(e=> {throw e});
  // }

  // NOTE: MySQL connection -> app.sql.url = user.Config.mysqlConnection;
  app.sql = new database.mysql(app.Config);
  app.sql.factor = service.utility.packageRequire('mysql');
  if (app.sql.url) await app.sql.handlePool().catch(e=>service.utility.log.msg(e));

  // NOTE: MongoDB connection -> app.mongo.url = user.Config.mongoConnection;
  app.mongo = new database.mongo(app.Config);
  // requestModule
  app.mongo.factor = service.utility.packageRequire('mongodb');
  if (app.mongo.url) await app.mongo.connect().catch(e=>service.utility.log.error(e));

  const job = require(user.starterCommand);
  async function jobTask(e){
    try {
      return await e();
    } catch (error) {
      throw error;
    }
  }
  if (typeof job == 'function' ) {
    return await jobTask(job)
  } else {
    const fn = userParam[0] || 'main';
    if (typeof job[fn] == 'function') {
      return await jobTask(job[fn])
    } else {
      throw {code:fn,message:typeof app[fn]};
    }
  }
}

module.exports = async () => await commandInitiate(config.environment.virtual);