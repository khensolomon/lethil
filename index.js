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
    var env = fs.readFileSync(path.resolve(dir, config.env));
    var buf = Buffer.from(env);
    return dotenv.parse(buf);
  },

  starter: function(src){
    if (fs.existsSync(src)) require(src);
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
          var environments = assist.environment(rootDir) || {};
          if (!environments.hasOwnProperty('name')) environments.name=id;

          if (environments.referer){
            environments.referer = service.utility.arrays.unique(environments.referer.split(',')).map(service.utility.hack.regex);
          }

          result.push({
            dir:{
              root:rootDir
            },
            starterMain:starterMain,
            hostname:hostname,
            env:environments,
            style:{},
            script:{}
          })
        }
      }
    }
    return result;
  },

  virtualCertificate: function() {
    var credentials = {};
    Object.keys(config.environment.certificate).forEach(function(k) {
      credentials[k] = fs.readFileSync(path.resolve(config.environment.certificate[k]), 'utf8');
    });
    return credentials;
  },

  virtualEnvironment: function() {
    try {
      var env = this.environment(rootCommon);
      env.certificate = env.certificate?JSON.parse(env.certificate):null;
      env.virtual=this.virtualData(JSON.parse(env.virtual));
      Object.assign(config.environment, env);
    } catch (error) {
      config.status.fail.push({
        reason:'.env',
        message:error.message
      });
    } finally {

    }
  },

  virtualPrepare: function(){
    for (const application of config.environment.virtual) this.virtualInitiate(application);
  },

  virtualInitiate: function(user){
    const app = require(user.starterMain);
    app.Core  = express();

    // NOTE: configuration
    app.Config = {};
    var starterConfig = path.resolve(user.dir.root,config.starter.config);
    if (fs.existsSync(starterConfig)) {
      const {config,styleMiddleWare,scriptMiddleWare} = require(starterConfig);
      if (config instanceof Object) app.Config = config;
      user.style = styleMiddleWare;
      user.script = scriptMiddleWare;
    }

    Object.assign(app.Config, user.env);

    // if (app.Config.referer){
    //   app.Config.referer = service.utility.arrays.unique(app.Config.referer.split(','));
    //   ['zaideih.*'].map(utility.hack.regex);
    // }

    // NOTE: directory
    app.Config.dir={
      root:user.dir.root,
      static: path.resolve(user.dir.root,config.directory.static),
      assets: path.resolve(user.dir.root,config.directory.assets),
      views: path.resolve(user.dir.root,config.directory.views),
      routes: path.resolve(user.dir.root,config.directory.routes)
    };

    // NOTE: middleware
    // app.Core.disable('x-powered-by');
    app.Core.use(helmet());
    app.Core.use((req, res, next) => {
      // app_name, app_version app_description app_development
      res.locals.appName = app.Config.name;
      res.locals.appVersion = app.Config.version;
      res.locals.appDescription = app.Config.description;
      res.locals.isDevelopment = app.Config.development;
      res.locals.forceSecure = config.environment.certificate && !req.secure && (!app.Config.forceHttps || app.Config.forceHttps == true)
      next();
    });
    app.Core.use(middleware.utility.secure);
    // app.Core.use(compression());
    app.Core.use(express.json());
    app.Core.use(express.urlencoded({ extended: false }));
    app.Core.use(cookieParser());
    app.Core.set('views', app.Config.dir.views);
    app.Core.set('view engine', 'pug');

    app.Core.use((req, res, next) => {
      if (user.env.hasOwnProperty('mysqlConnection')) {
        app.sql = new database.mysql(user.env.mysqlConnection);
      }
      next();
    });

    // NOTE: express.Router();
    app.Router = express.Router;

    // NOTE: nav, and its middleware
    var nav = new middleware.nav(app);
    app.Core.use(nav.register);
    app.Navigation = (Id)=>nav.insert(Id);

    // NOTE: app->middleware
    assist.starter(path.resolve(user.dir.root,config.starter.middleware));

    // NOTE: execute, after user middleware
    if (fs.existsSync(app.Config.dir.static)) {
      if (fs.existsSync(app.Config.dir.assets)){
        if (user.style instanceof Object) {
          user.style.src=path.resolve(app.Config.dir.assets, 'scss');
          // user.style.dest=path.resolve(app.Config.dir.static,'css');
          user.style.dest=app.Config.dir.static;
          app.Core.use(middleware.style(user.style));
        }
        if (user.script instanceof Object) {
          user.script.src=path.resolve(app.Config.dir.assets, 'script');
          // user.script.dest=path.resolve(app.Config.dir.static,'jsmiddlewareoutput');
          user.script.dest=app.Config.dir.static;
          app.Core.use(middleware.script(user.script));
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
    assist.starter(path.resolve(user.dir.root,config.starter.route));

    // NOTE: vhost
    user.hostname.forEach(name => {
      if (!name || name == "*") {
        essence.use(app.Core);
      } else {
        essence.use(vhost(name, app.Core));
      }
    });
    service.utility.log.hostname(user.env.name, user.hostname);

    // NOTE: catch 404 and forward to error handler
    app.Core.use(middleware.utility.notfound);
  }
};

module.exports = {
  express: express,
  root:rootCommon,
  utility:service.utility,
  fs:fs,
  // vhost:vhost,
  // url:url,
  server() {
    assist.virtualEnvironment();
    try {
      assist.virtualPrepare();
    } catch (e) {
      config.status.fail.push({
        reason:'.js',
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
        https.createServer(assist.virtualCertificate(), essence).listen(443,function(){
          service.utility.log.listen('port', 443);
        });
      }
    }
    return serve;
  }
};