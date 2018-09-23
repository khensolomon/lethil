import * as root from './essential';
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
export const sassMiddleWare = require('node-sass-middleware');
export const httpErrors = require('http-errors');

// NOTE: environments.config({path: rootRequest.path.join(__dirname,'.env')});
// TODO: multi ports configuration
const applications = express();

const rootRequest=root.request;
const rootUtility=root.utility;

const rootSetting=root.configuration.setting;
const rootDirectory=root.configuration.directory;

const rootObject=rootUtility.objects;
const rootArray=rootUtility.arrays;
const rootValidate=rootUtility.check;

// export namespace serve {}
export class http {
  private server?:any;
  private bind?:any;
  constructor(appName?:string) {
    if (!rootSetting.hasOwnProperty('root')) this.root();
    if (appName)rootSetting.name = appName;
  }
  test(){
    console.log('Ok evh');
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
      applications.set('port', rootSetting.port);
    }
    // NOTE: javascript
    // this.server = http.createServer(applications);
    this.server = createServer(applications);
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
// export const navMiddleWare = nav.middleware;
// export class navMiddleWare extends nav.middleware {
// };
const callbackListening = () => {
  if (Object.keys(rootSetting.listening).length == 0){
    rootUtility.log.msg('listening',rootSetting.bind,'but no app were found');
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
              const user = require(appMain);
              user.app  = express();
              // NOTE: environments
              const score = virtualEnvironment(rootRequest.path.join(appDir,rootSetting.env));

              if (!score.hasOwnProperty('name')) score.name=dirName;
              if (!score.hasOwnProperty('version')) score.version=rootSetting.version;
              // NOTE: directory
              score.dir={
                root: appDir,
                // public: rootRequest.path.resolve(appDir,'public'),
                static: rootRequest.path.resolve(appDir,'static'),
                assets: rootRequest.path.resolve(appDir,'assets'),
                views: rootRequest.path.resolve(appDir,'views'),
                routes: rootRequest.path.resolve(appDir,'routes')
              };
              score.sassMiddleWare = {
                prefix: '/css',
                indentedSyntax: false,
                debug: true,
                response:false,
                // NOTE: nested, expanded, compact, compressed
                outputStyle: 'compressed',
                sourceMap: false
              };
              if (!user.hasOwnProperty('score')) user.score=new Object();
              rootObject.merge(user.score,rootObject.merge(score,user.score));

              // NOTE: database
              user.app.use((req?:any, res?:any, next?:any) => {
              // TODO: improve (position,installation,making var)
                if (user.score.hasOwnProperty('mysqlConnection')) user.score.sql = new database.connection.mysql(user.score.mysqlConnection);
                next();
              });
              user.app.set('views', user.score.dir.views);
              user.app.set('view engine', 'pug');
              user.app.use(morgan('dev'));
              user.app.use(express.json());
              user.app.use(express.urlencoded({ extended: false }));
              user.app.use(cookieParser());
              // user.app.use(middleware.compression());

              // TODO: improve (conditionals, installation)
              if (user.score.dir.static) {
                // NOTE: css middleware
                if (user.score.dir.assets){
                  if (rootValidate.isObject(user.score.sassMiddleWare)){
                    // TODO: reading custom path scss and css
                    user.score.sassMiddleWare.src=rootRequest.path.resolve(user.score.dir.assets, 'scss');
                    user.score.sassMiddleWare.dest=rootRequest.path.resolve(user.score.dir.static,'css');
                    user.app.use(sassMiddleWare(user.score.sassMiddleWare));
                  }
                  // NOTE: to be continuous using uglify-es
                  user.app.use(middleware.js());
                }
                // NOTE: static should be defined in user Applications
                user.app.use(express.static(user.score.dir.static));
              }
              var nav = new middleware.nav(user);
              user.app.use(nav.register);
              user.nav = (Id:string)=>nav.insert(Id);
              // NOTE: routing must be defined in user Applications
              if (rootValidate.isFunction(user)) user(user);
              let appRoute = rootRequest.path.resolve(appDir,rootSetting.route);
              if (rootRequest.fs.existsSync(appRoute)) require(appRoute);

              // NOTE: vhost
              if (rootValidate.isArray(virtualHost[dirName])) {
                virtualHost[dirName].forEach((k:string)=>applications.use(vhost(k, user.app)));
                rootSetting.listening[dirName]=virtualHost[dirName];
              }
              rootUtility.log.msg(rootSetting.Ok,user.score.name);

              // NOTE: catch 404 and forward to error handler
              user.app.use((req?:any, res?:any, next?:any) => next(httpErrors(404)));

              // NOTE: error handler
              user.app.use(middleware.nav.error);
            } catch (e) {
              console.log(e);
            }
          }
        }
      }
    }
  }
};