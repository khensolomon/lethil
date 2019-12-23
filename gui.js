const fs = require('fs');
const path = require("path");

const express = require("express");
// const vhost = require("vhost");
// const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser')

const config = require("./config");
const middleware = require("./middleware");
const database = require("./database");
const service = require("./service");

// serverPrepare
const Framework = express();

function requestStarter(src){
  if (fs.existsSync(src)) return require(src);
}
async function serverInitiate(user){
  const app = require(user.starterMain);
  // app.Core  = express();
  app.Core  = Framework;

  // NOTE: configuration
  app.Config = user.Config;

  // NOTE: initiator if only exists!
  requestStarter(path.resolve(app.Config.dir.root,config.starter.initiator));

  // NOTE: MySQL connection -> app.sql.url = app.Config.mysqlConnection;
  app.sql = new database.mysql(app.Config);
  app.sql.factor = service.utility.packageRequire('mysql');
  if (app.sql.url) app.sql.handlePool().catch(e=>service.utility.log.msg(e));

  // NOTE: MongoDB connection -> app.mongo.url = app.Config.mongoConnection;
  app.mongo = new database.mongo(app.Config);
  app.mongo.factor = service.utility.packageRequire('mongodb');
  if (app.mongo.url) app.mongo.connect().catch(e=>service.utility.log.error(e));

  // NOTE: middleware
  app.Core.use(compression());
  app.Core.use(express.json());
  // app.Core.disable('x-powered-by');
  const helmet = service.utility.packageRequire('helmet');
  if (helmet) app.Core.use(helmet());
  app.Core.use((req, res, next) => {
    res.locals.appName = app.Config.name;
    res.locals.appVersion = app.Config.version;
    res.locals.appDescription = app.Config.description;
    // if (app.Config.hasOwnProperty('visits')) {
    //   if (app.Config.visits.hasOwnProperty('counts'))app.Config.visits.counts++;
    // }

    if (req.get('Referrer')){
      var ref_hostname = new URL(req.get('Referrer')).hostname;
      res.locals.referer = req.hostname == ref_hostname || app.Config.referer.filter(e=>e.exec(ref_hostname)).length
    }
    next();
  });
  // app.Core.use(middleware.utility.redirect);
  // app.Core.use(middleware.utility.restrict);

  app.Core.use(express.urlencoded({ extended: false }));
  app.Core.use(cookieParser());
  app.Core.set('views', app.Config.dir.views);
  app.Core.set('view cache', true);
  app.Core.set('view engine', 'pug');

  // NOTE: express.Router();
  app.Router = express.Router;

  // NOTE: app->navigator, and its middleware anv
  const anv = new middleware.nav(app);
  app.Core.use(anv.register);
  app.Navigation = (Id)=>anv.insert(Id);

  // NOTE: app->middleware
  const amw = requestStarter(path.resolve(app.Config.dir.root,config.starter.middleware));
  Object.keys(app.Config.restrict).forEach(uri=>{
    var fn = app.Config.restrict[uri];
    if (amw[fn] instanceof Function) {
      app.Core.use(uri, function(req, res, next) {
        if (amw[fn](req, res)) {
          next();
        } else {
          res.status(404).end();
        }
      });
    }
  });

  // NOTE: execute, after user middleware
  // if (config.proxy.single == false && fs.existsSync(app.Config.dir.static)) {
  //   if (fs.existsSync(app.Config.dir.assets) && amw){
  //     if (amw.style instanceof Object) {
  //       amw.style.src=path.resolve(app.Config.dir.assets, 'scss');
  //       // amw.style.dest=path.resolve(app.Config.dir.static,'css');
  //       amw.style.dest=app.Config.dir.static;
  //       app.Core.use(middleware.style(amw.style));
  //     }
  //     if (amw.script instanceof Object) {
  //       amw.script.src=path.resolve(app.Config.dir.assets, 'script');
  //       // amw.script.dest=path.resolve(app.Config.dir.static,'jsmiddlewareoutput');
  //       amw.script.dest=app.Config.dir.static;
  //       app.Core.use(middleware.script(amw.script));
  //     }
  //   }
  //   // NOTE: static should be defined in user Applications
  //   app.Core.use(express.static(app.Config.dir.static));
  // }

  // NOTE: common static rootCommon
  // if (config.proxy.single == false) {
  //   var commonStatic = path.resolve(rootCommon, config.directory.static);
  //   if (fs.existsSync(commonStatic)) {
  //     app.Core.use(express.static(commonStatic));
  //   }
  // }

  // NOTE: routing must be defined in app Applications
  requestStarter(path.resolve(app.Config.dir.root,config.starter.route));

  // NOTE: catch 404 and forward to error handler
  app.Core.use(middleware.utility.notfound);

  // NOTE: set port
  if (process.env.PORT) {
    config.environment.PORT = process.env.PORT.trim()
  }
  app.Core.set('port', parseInt(config.environment.PORT));

  // NOTE: listen port
  if (typeof process.env.LISTEN != 'undefined') {
    // if user requested, then use it, on empty open to all incomming network
    config.environment.LISTEN = process.env.LISTEN.trim() || null;
  }
  app.Core.listen(app.Core.get('port'),config.environment.LISTEN);
}

module.exports = async () => await serverInitiate(config.environment.virtual);