const path = require("path");
const http = require('http');
const https = require('https');

const fs = require('fs-extra');
const dotenv = require("dotenv");
const express = require("express");
const vhost = require("vhost");
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser')

// const url = require('url');

const config = require("./config");
const middleware = require("./middleware");
const database = require("./database");
const service = require("./service");

const essence = express();
const rootCommon = process.mainModule.paths[0].split('node_modules')[0].slice(0, -1);

var assist={
  environment: function(dir) {
    // return dotenv.config({path:path.resolve(dir, config.env)}).parsed;
    // var env = fs.readFileSync(path.resolve(dir, config.env));
    // return dotenv.parse(Buffer.from(env));
    var env = path.resolve(dir, config.env);
    if (fs.existsSync(env)){
      var e = fs.readFileSync(env);
      return dotenv.parse(Buffer.from(e));
    } else {
      return {};
    }
  },

  starter: function(src){
    if (fs.existsSync(src)) return require(src);
  },

  virtualData: function(virtuals) {
    var result=[];
    for (const id in virtuals) {
      if (virtuals.hasOwnProperty(id)) {
        var vh = virtuals[id];
        var hostname = (vh && typeof vh === 'string')?service.utility.arrays.unique(vh.split(',')):["*"];
        var rootDir = path.resolve(rootCommon, id);
        var starterMain = path.resolve(rootDir, config.starter.main);
        if (fs.existsSync(starterMain)){
          var environments = {};
          try {
            environments = assist.environment(rootDir);
          } catch (error) {
            config.status.fail.push({
              code:'.env',
              message:error.message
            });
          }
          var user = {
            starterMain:starterMain,
            hostname:hostname
          };

          user.Config = Object.assign({
            name:id,
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
              service.utility.log.error(error)
            }
          }

          if (environments.referer){
            environments.referer = service.utility.arrays.unique(environments.referer.split(',')).map(service.utility.hack.regex);
          }
          if (environments.restrict){
            environments.restrict = service.utility.hack.env(environments.restrict);
          }

          Object.assign(user.Config, environments);
          result.push(user)
        }
      }
    }
    return result;
  },

  virtualEnvironment: function() {
    try {
      var env = this.environment(rootCommon);
      var _allowed = Object.keys(config.environment);
      Object.assign(
        config.common,
        Object.keys(env).filter(
          e => !_allowed.includes(e)
        ).reduce(
          (o, i) => Object.assign(({[i]: env[i]}),o), {}
        )
      );
      if (env.virtual) env.virtual=this.virtualData(service.utility.hack.env(env.virtual));
      // if (env.certificate)env.certificate=service.utility.hack.env(env.certificate);
      Object.assign(config.environment, env);
    } catch (error) {
      config.status.fail.push({
        code:'.env',
        message:error.message
      });
    } finally {
    }
  },

  virtualPrepare: function()  {
    for (const application of config.environment.virtual) this.virtualInitiate(application);
  },

  virtualInitiate: function(user){
    const app = require(user.starterMain);
    app.Core  = express();

    // NOTE: configuration
    app.Config = user.Config;

    // NOTE MySQL connection -> app.sql.url = user.Config.mysqlConnection;
    app.sql = new database.mysql(app.Config);
    if (app.sql.url) app.sql.connect().catch(e=>service.utility.log.error(e));

    // NOTE MongoDB connection -> app.mongo.url = user.Config.mongoConnection;
    app.mongo = new database.mongo(app.Config);
    if (app.mongo.url) app.mongo.connect().catch(e=>service.utility.log.error(e));

    // NOTE: middleware
    // app.Core.disable('x-powered-by');
    app.Core.use(helmet());
    app.Core.use((req, res, next) => {
      res.locals.appName = app.Config.name;
      res.locals.appVersion = app.Config.version;
      res.locals.appDescription = app.Config.description;
      res.locals.isDevelopment = app.Config.development;
      res.locals.forceHTTPS = config.environment.certificate && !req.secure && app.Config.forceHTTPS == true;
      res.locals.forceWWW = app.Config.forceWWW;
      if (req.get('Referrer')){
        var ref_hostname = new URL(req.get('Referrer')).hostname;
        res.locals.referer = req.hostname == ref_hostname || app.Config.referer.filter(e=>e.exec(ref_hostname)).length
      }
      next();
    });
    app.Core.use(middleware.utility.redirect);
    // app.Core.use(middleware.utility.restrict);

    app.Core.use(compression());
    app.Core.use(express.json());
    app.Core.use(express.urlencoded({ extended: false }));
    app.Core.use(cookieParser());
    app.Core.set('views', app.Config.dir.views);
    app.Core.set('view engine', 'pug');

    // app.Core.use((req, res, next) => {
    //   if (user.Config.hasOwnProperty('mysqlConnection')) {
    //     app.sql = new database.mysql(user.Config.mysqlConnection);
    //   }
    //   next();
    // });
    // app.Core.use((req, res, next) => {
    //   const md = new new database.mongo(user.Config.mongoConnection);
    //   md.connect().then((db)=>{
    //     app.db = db;
    //     // app.Core.use((req, res, next) => {
    //     //   app.db = db
    //     //   next();
    //     // });
    //   }).catch(e=>console.log(e));
    //   next();
    // });

    // NOTE: express.Router();
    app.Router = express.Router;

    // NOTE: app->navigator, and its middleware anv
    const anv = new middleware.nav(app);
    app.Core.use(anv.register);
    app.Navigation = (Id)=>anv.insert(Id);

    // NOTE: app->middleware
    const amw = assist.starter(path.resolve(app.Config.dir.root,config.starter.middleware));
    Object.keys(app.Config.restrict).forEach((uri)=>{
      var fn = app.Config.restrict[uri];
      if (amw[fn] instanceof Function) {
        app.Core.use(uri, function(req, res, next) {
          if (amw[fn](req, res)) return next();
          res.status(404).end();
        });
      }
    });

    // NOTE: execute, after user middleware
    if (fs.existsSync(app.Config.dir.static)) {
      if (fs.existsSync(app.Config.dir.assets) && amw){
        if (amw.style instanceof Object) {
          amw.style.src=path.resolve(app.Config.dir.assets, 'scss');
          // amw.style.dest=path.resolve(app.Config.dir.static,'css');
          amw.style.dest=app.Config.dir.static;
          app.Core.use(middleware.style(amw.style));
        }
        if (amw.script instanceof Object) {
          amw.script.src=path.resolve(app.Config.dir.assets, 'script');
          // amw.script.dest=path.resolve(app.Config.dir.static,'jsmiddlewareoutput');
          amw.script.dest=app.Config.dir.static;
          app.Core.use(middleware.script(amw.script));
        }
      }
      // NOTE: static should be defined in user Applications
      app.Core.use(express.static(app.Config.dir.static));
    }

    // NOTE: common static rootCommon
    var commonStatic = path.resolve(rootCommon, config.directory.static);
    if (fs.existsSync(commonStatic)) {
      app.Core.use(express.static(commonStatic));
    }

    // NOTE: routing must be defined in app Applications
    assist.starter(path.resolve(app.Config.dir.root,config.starter.route));

    // NOTE: vhost
    user.hostname.forEach(name => {
      if (!name || name == "*") {
        essence.use(app.Core);
      } else {
        essence.use(vhost(name, app.Core));
      }
    });
    service.utility.log.hostname(app.Config.name, user.hostname);
    // NOTE: catch 404 and forward to error handler
    app.Core.use(middleware.utility.notfound);
  },

  commandInitiate: async function(args){
    // return new Promise((resolve,reject)=>{});
    var id = args.shift();
    var NoStarter = '...no starter';
    if (!id) throw 'Application name?';
    var o = config.environment.virtual.filter(e=>e.Config.name.toLowerCase() == id.toLowerCase());
    if (o.length){
      var cli = path.resolve(o[0].Config.dir.root, config.starter.command);
      if (fs.existsSync(cli)) {
        try {
          const app = require(cli);
          Object.assign(app,o[0]);

          app.sql = new database.mysql(app.Config);
          if (app.sql.url) {
            await app.sql.connect().catch(e=>{throw e});
          }

          // var cm = path.resolve(app.Config.dir.root, 'classMongo.js');
          // if (fs.existsSync(cm)) const o = require(cm);
          app.mongo = new database.mongo(app.Config);
          if (app.mongo.url) {
            await app.mongo.connect().catch(e=> {throw e});
          }

          var fn = args.shift() || 'main';
          app.args = args;
          if (app.hasOwnProperty(fn) && typeof app[fn] == 'function') {
            await app[fn]()
          } else {
            throw NoStarter.replace('no',fn).replace('starter',typeof app[fn]);
          }

        } catch (error) {
          throw error.message || error;
        }
      } else {
        throw NoStarter.replace('starter',config.starter.command);
      }
    } else {
      throw NoStarter.replace('starter',id);
    }
  }
};

module.exports = {
  express: express,
  root:rootCommon,
  utility:service.utility,
  fs:fs,
  path:path,

  run(uri) {
    assist.virtualEnvironment();
    assist.commandInitiate(uri).catch(
      e=>console.log(e)
    ).then(
      ()=>process.exit()
    );
  },

  serve() {
    assist.virtualEnvironment();
    try {
      assist.virtualPrepare();
    } catch (e) {
      config.status.fail.push({
        code:'.js',
        message:e.message
      });
    } finally {
      essence.set('port', config.environment.port);
    }

    essence.use(middleware.utility.error);

    var serve = http.createServer(essence);
    if (config.status.fail.length) {
      for (const msg of config.status.fail) service.utility.log.fail(msg);
    } else {
      serve.listen(config.environment.port,function(){
        var address = serve.address();
        var bindAddress = typeof address === 'string'? address: address.port;
        var bindPort = typeof address === 'string'?'pipe':'port';
        service.utility.log.listen(bindPort, bindAddress);
      });
      if (config.environment.certificate){
        try {
          https.createServer(service.utility.hack.env_format(config.environment.certificate).reduce(
            (o, i) => Object.assign(o,({[i[0]]: fs.readFileSync(path.resolve(i[1]), 'utf8')})), {}
          ), essence).listen(config.environment.portSecure,function(){
            service.utility.log.listen('port', config.environment.portSecure);
          });
        } catch (e) {
          config.environment.certificate=null;
          service.utility.log.error(e);
        }
      }
    }
    return serve;
  }
};