import * as root from './service/';
import * as middleware from './middleware/';
import * as database from './database/';

export const express = require('express');
export const environments = require('dotenv');
export const debug = require('debug')('http');
const vhost = require('vhost');
const {Server, createServer} = require('http');
// import {Server, createServer} from 'http';
export const cookieParser = require('cookie-parser');
export const morgan = require('morgan');
export const nodeSASSMiddleWare = require('node-sass-middleware');
export const httpErrors = require('http-errors');

// NOTE: environments.config({path: rootRequest.path.join(__dirname,'.env')});
// TODO: multi ports configuration
export const essence = express();

const rootRequest=root.request;
const rootUtility=root.utility;

const rootConfiguration=root.configuration;
const rootSetting=rootConfiguration.setting;
const rootDirectory=root.configuration.directory;

const rootObject=rootUtility.objects;
const rootArray=rootUtility.arrays;
const rootValidate=rootUtility.check;

export class http {
  private server?:any;
  private bind?:any;
  constructor(appName?:string) {
    if (!rootSetting.hasOwnProperty('root')) this.root();
    if (appName)rootSetting.name = appName;
  }
  test(){
    console.log('evh');
  }
  root(dir?:string) {
    rootSetting.root = dir || process.mainModule.paths[0].split('node_modules')[0].slice(0, -1);
  }
  port(port?:string) {
    // TODO: port from environments (process.env.PORT)
    // NOTE: Normalize a port into a number, string, or false.
    if (port) rootSetting.port = port;

    let k = rootSetting.port;
    rootSetting.port = parseInt(k, 10);
    if (isNaN(rootSetting.port)) {
      // NOTE: named pipe
      rootSetting.port = k;
    } else if (rootSetting.port <= 0) {
      // NOTE: port number
      rootSetting.port = false;
    }
  }
  main(main?: string){
    rootSetting.main = main || rootSetting.main;
  }
  listen() {
    // HACK: environments.config();
    let env = rootRequest.path.join(rootSetting.root,rootSetting.env);
    rootObject.merge(rootSetting,virtualEnvironment(env));
    this.port();
    try {
      virtualHost();
    } catch (e) {
      console.error(e);
    } finally {
      essence.set('port', rootSetting.port);
    }
    // NOTE: javascript
    // this.server = http.createServer(essence);
    this.server = createServer(essence);
    this.server.listen(rootSetting.port/*,'0.0.0.0'*/);

    let address = this.server.address();
    // rootSetting.address = address.address;
    rootSetting.bind = typeof address === 'string'?'pipe:' + address:'port:' + address.port;
    return this.server;
  }
  stop() {
    this.server.close();
  }
  close(callback?:any) {
    // HACK: <http>.close(); callbackClose
    this.server.on('close', rootValidate.isFunction(callback)?callback:callbackClose);
  }
  error(callback?:any) {
    // NOTE: Event listener for HTTP server "error" event.
    this.server.on('error', rootValidate.isFunction(callback)?callback:callbackError);
  }
  listening(callback?:any) {
    // NOTE: Event listener for HTTP server "listening" event.
    this.server.on('listening', rootValidate.isFunction(callback)?callback:callbackListening);
  }
};
const callbackListening = () => {
  if (Object.keys(rootSetting.listening).length == 0){
    rootUtility.log.msg('listening',rootSetting.bind,'but no App were found');
  } else {
    let on = rootSetting.bind.split(':');
    rootUtility.log.msg('listening',on[0],on[1]);
  }
},
callbackError = (e:any) => {
  if (e.syscall !== 'listen')throw e;
  // NOTE: handle specific listen errors with friendly messages
  switch (e.code) {
    case 'EACCES':
      rootUtility.log.msg(e.code.toLowerCase(),rootSetting.bind,'requires elevated privileges');process.exit(1);
    break;
    case 'EADDRINUSE':
      rootUtility.log.msg(e.code.toLowerCase(),rootSetting.bind,'already in use');process.exit(1);
    break;
    default:
      throw e;
  }
},
callbackClose = () => {
  rootUtility.log.msg('successfully','closed');
},
virtualEnvironment = (e:string) => {
  if (rootRequest.fs.existsSync(e)) return environments.parse(rootRequest.fs.readFileSync(e));
  return new Object();
},
virtualHost = () => {
  let virtual = rootRequest.fs.readJsonSync(rootRequest.path.join(rootSetting.root,rootSetting.json));
  if (virtual.hasOwnProperty('virtual') && rootValidate.isObject(virtual.virtual)){
    let virtualHost = virtual.virtual;

    for (var dirName in virtualHost) {
      if (virtualHost.hasOwnProperty(dirName)) {
        let appDir = dirName;
        if (rootRequest.fs.existsSync(appDir)) {
          let appMain = rootRequest.path.resolve(appDir,rootSetting.main);
          if (rootRequest.fs.existsSync(appMain)) {
            try {
              // NOTE: environments
              const env = virtualEnvironment(rootRequest.path.join(appDir,rootSetting.env));
              if (!env.hasOwnProperty('name')) env.name=dirName;
              if (!env.hasOwnProperty('version')) env.version=rootSetting.version;

              const user = require(appMain);
              user.core  = express();

              // NOTE: directory
              env.dir={
                root: appDir,
                // public: rootRequest.path.resolve(appDir,'public'),
                static: rootRequest.path.resolve(appDir,'static'),
                assets: rootRequest.path.resolve(appDir,'assets'),
                views: rootRequest.path.resolve(appDir,'views'),
                routes: rootRequest.path.resolve(appDir,'routes')
              };
              // NOTE: get default style configuration
              env.styleMiddleWare = rootConfiguration.style;
              env.scriptMiddleWare = rootConfiguration.script;

              if (!user.hasOwnProperty('score')) {
                let appScore = rootRequest.path.resolve(appDir,rootSetting.score);
                if (rootRequest.fs.existsSync(appScore)) {
                  const {score} = require(appScore);
                  user.score = score;
                } else {
                  user.score = new Object();
                }
              }
              // if (!user.hasOwnProperty('score')) user.score=new Object();
              rootObject.merge(user.score,rootObject.merge(env,user.score));

              // // NOTE: middleware ?? working
              // let userMiddleware = rootRequest.path.resolve(appDir,rootSetting.middleware);
              // if (rootRequest.fs.existsSync(userMiddleware)) require(userMiddleware);

              // NOTE: database
              user.core.use((req?:any, res?:any, next?:any) => {
              // TODO: improve (position,installation,making var)
                // if (user.score.hasOwnProperty('mysqlConnection')) user.score.sql = new database.connection.mysql(user.score.mysqlConnection);
                if (user.score.hasOwnProperty('mysqlConnection')) {
                  user.sql = new database.connection.mysql(user.score.mysqlConnection);
                }
                next();
              });
              user.core.set('views', user.score.dir.views);
              user.core.set('view engine', 'pug');
              user.core.use(morgan('dev'));
              user.core.use(express.json());
              user.core.use(express.urlencoded({ extended: false }));
              user.core.use(cookieParser());
              // user.core.use(middleware.compression());

              // TODO: improve (conditionals, installation)
              if (user.score.dir.static) {
                // NOTE: css middleware
                if (user.score.dir.assets){
                // user.score.hasOwnProperty('styleMiddleWare') &&
                  if (rootValidate.isObject(user.score.styleMiddleWare) && Object.keys(user.score.styleMiddleWare).length){
                    // TODO: reading custom path scss and css
                    user.score.styleMiddleWare.src=rootRequest.path.resolve(user.score.dir.assets, 'scss');
                    user.score.styleMiddleWare.dest=rootRequest.path.resolve(user.score.dir.static,'css');
                    user.core.use(nodeSASSMiddleWare(user.score.styleMiddleWare));
                    // TODO: user.core.use(middleware.style(user.score.styleMiddleWare));
                  }
                  // user.score.hasOwnProperty('scriptMiddleWare') &&
                  if (rootValidate.isObject(user.score.scriptMiddleWare) && Object.keys(user.score.scriptMiddleWare).length){
                    // NOTE: to be continuous using uglify-es
                    user.score.scriptMiddleWare.src=rootRequest.path.resolve(user.score.dir.assets, 'script');
                    user.score.scriptMiddleWare.dest=rootRequest.path.resolve(user.score.dir.static,'jsmiddlewareoutput');
                    user.core.use(middleware.script(user.score.scriptMiddleWare));
                  }
                }
                // NOTE: static should be defined in user Applications
                user.core.use(express.static(user.score.dir.static));
              }
              // if (user.hasOwnProperty('middleware') && rootValidate.isFunction(user.middleware)) user.middleware(user.core);
              // user.middleware = (Id:string)=>user.core.use(Id);

              // NOTE: express.Router();
              user.router = express.Router;

              // NOTE: nav, and its middleware
              var nav = new middleware.nav(user);
              user.core.use(nav.register);
              user.nav = (Id:string)=>nav.insert(Id);
              // NOTE: middleware ?? working
              let userMiddleware = rootRequest.path.resolve(appDir,rootSetting.middleware);
              if (rootRequest.fs.existsSync(userMiddleware)) require(userMiddleware);

              // NOTE: routing must be defined in user Applications
              if (rootValidate.isFunction(user)) user(user.core);
              let userRoute = rootRequest.path.resolve(appDir,rootSetting.route);
              if (rootRequest.fs.existsSync(userRoute)) require(userRoute);

              // NOTE: vhost
              if (rootValidate.isArray(virtualHost[dirName])) {
                virtualHost[dirName].forEach((k:string)=>essence.use(vhost(k, user.core)));
                rootSetting.listening[dirName]=virtualHost[dirName];
              }
              rootUtility.log.msg(rootSetting.Ok,user.score.name);

              // NOTE: catch 404 and forward to error handler
              user.core.use((req?:any, res?:any, next?:any) => next(httpErrors(404)));

              // NOTE: error handler
              user.core.use(middleware.nav.error);
            } catch (e) {
              console.log(e);
            }
          }
        }
      }
    }
  }
};