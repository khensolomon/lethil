const path = require("path");
const fs = require('fs-extra');
const http = require('http');

const dotenv = require("dotenv");
const express = require("express");
const vhost = require("vhost");
const compression = require('compression');
const cookieParser = require('cookie-parser')

const config = require("./config");
const middleware = require("./middleware");
const database = require("./database");
const service = require("./service");

const essence = express();
const root = process.mainModule.paths[0].split('node_modules')[0].slice(0, -1);

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
        var hostname = virtuals[id];
        var rootDir = path.resolve(root, id);
        var starterMain = path.resolve(rootDir, config.starter.main);
        if (fs.existsSync(starterMain)){
          var environments = assist.environment(rootDir) || {};
          if (!environments.hasOwnProperty('name')) environments.name=id;
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
  virtualEnvironment: function() {
    var env = this.environment(root);
    var virtual = JSON.parse(env.virtual);
    env.virtual=this.virtualData(virtual);
    Object.assign(config.environment, env);
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

    // NOTE: directory
    app.Config.dir={
      root:user.dir.root,
      static: path.resolve(user.dir.root,config.directory.static),
      assets: path.resolve(user.dir.root,config.directory.assets),
      views: path.resolve(user.dir.root,config.directory.views),
      routes: path.resolve(user.dir.root,config.directory.routes)
    };

    // NOTE: middleware
    app.Core.use(compression());
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

    // NOTE: routing must be defined in app Applications
    assist.starter(path.resolve(user.dir.root,config.starter.route));

    // NOTE: vhost
    if (user.hostname.length){
      user.hostname.forEach(name => {
        if (name) {
          essence.use(vhost(name, app.Core));
        } else {
          essence.use(app.Core);
        }
      });
    } else {
      essence.use(app.Core);
    }
    service.utility.log.listen(user.env.name, user.hostname.join(', ') || '*');

    // NOTE: catch 404 and forward to error handler
    app.Core.use(middleware.error.http);
  },
};

module.exports = {
  express: express,
  root:root,
  utility:service.utility,
  fs:fs,
  server: function() {
    assist.virtualEnvironment();
    try {
      assist.virtualPrepare();
    } catch (e) {
      console.error(e);
    } finally {
      essence.set('port', config.environment.port);
    }
    essence.use(middleware.error.http);

    var serve = http.createServer(essence);
    serve.listen(config.environment.port);
    var address = serve.address();
    var bindAddress = typeof address === 'string'? address: address.port;
    var bindPort = typeof address === 'string'?'Pipe':'port';
    service.utility.log.listen(bindPort, bindAddress);
    return serve;
  }
};