import * as root from './essential';
import * as database from './database';

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
const applications = express();
// NOTE: environments.config({path: rootRequest.path.join(__dirname,'.env')});
// TODO: expressVirtual,express,environments,debug

const rootRequest=root.request;

const rootSetting=root.configuration.setting;
const rootDirectory=root.configuration.directory;

const rootObject=root.utility.objects;
const rootArray=root.utility.arrays;
const rootValidate=root.utility.check;

// export namespace serve {}
export class http {
  private server?:any;
  private bind?:any;
  constructor() {
    if (!rootSetting.hasOwnProperty('root')) this.root();
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
    } else if(rootSetting.port <= 0) {
      // NOTE: port number
      rootSetting.port = false;
    }
  }
  main(main?: string){
    rootSetting.main = main || rootSetting.main;
  }
  start() {
    // TODO: if http is on listening????
    // environments.config();
    let configEnv = rootRequest.path.join(rootSetting.root,rootSetting.env);
    if (rootRequest.fs.existsSync(configEnv)) {
      let env = environments.parse(rootRequest.fs.readFileSync(configEnv));
      root.utility.objects.merge(rootSetting,env);
    }
    this.port();

    try {
      virtualHost();
    } catch (e) {
      console.error(e);
    } finally {
      applications.set('port', rootSetting.port);
    }
    // this.server = http.createServer(applications);
    this.server = createServer(applications);
    this.server.listen(rootSetting.port);

    let address = this.server.address();
    this.bind = typeof address === 'string'?'pipe:' + address:'port:' + address.port;
    return this.server;
  }
  stop() {
    this.server.close();
  }
  close(callback?:any) {
    if(root.utility.check.isFunction(callback))this.server.on('close', callback);
  }
  error(callback?:any) {
    // NOTE: Event listener for HTTP server "error" event.
    this.server.on('error', (e:any)=>{
      if (e.syscall !== 'listen')throw e;
      let bind = this.bind;
      // NOTE: handle specific listen errors with friendly messages
      switch (e.code) {
        case 'EACCES':
          // if (callback && callback instanceof Function) {
          //   callback(bind + ' requires elevated privileges');
          // } else {
          //   console.error(bind + ' requires elevated privileges');
          // }
          root.utility.check.isFunction(callback)?callback(bind + ' requires elevated privileges'):console.error(bind + ' requires elevated privileges');
          process.exit(1);
        break;
        case 'EADDRINUSE':
          // if (callback && callback instanceof Function) {
          //   callback(bind + ' is already in use');
          // } else {
          //   console.error(bind + ' is already in use');
          // }
          root.utility.check.isFunction(callback)?callback(bind + ' is already in use'):console.error(bind + ' is already in use');
          process.exit(1);
        break;
        default:
          throw e;
      }
    });
  }
  listening(callback?:any) {
    // NOTE: Event listener for HTTP server "listening" event.
    this.server.on('listening', ()=>{
      if (root.utility.check.isFunction(callback)) {
        callback(this);
      } else {
        console.log('listening on',this.bind,Object.keys(rootSetting.listening).length == 0?'but no app were found!':'...');
      }
    });
  }
}
// const virtualListening = () => {
// }
// const virtualError = () => {
// }
// const virtualClose = () => {
// }
const virtualEnvironment = (e:string) => {
  if (rootRequest.fs.existsSync(e)) return environments.parse(rootRequest.fs.readFileSync(e));
  return new Object();
}
const virtualHost = () => {
  let virtual = rootRequest.fs.readJsonSync(rootRequest.path.join(rootSetting.root,rootSetting.json));
  if (virtual.hasOwnProperty('host') && root.utility.check.isObject(virtual.host)){
    let virtualHost = virtual.host;

    for (var dirName in virtualHost) {
      if (virtualHost.hasOwnProperty(dirName)) {
        let appDir = dirName;
        if (rootRequest.fs.existsSync(appDir)) {
          let appMain = rootRequest.path.resolve(appDir,rootSetting.main);
          if (rootRequest.fs.existsSync(appMain)) {
            try {
              const app = express();
              const user = require(appMain);
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
              rootObject.merge(user.score,rootObject.merge(score,user.score));

              // NOTE: database
              app.use(function(req?:any, res?:any, next?:any) {
                if(user.score.hasOwnProperty('mysqlConnection')) user.score.sql = new database.connection.mysql(user.score.mysqlConnection);
                next();
              });
              app.set('views', user.score.dir.views);
              app.set('view engine', 'pug');
              app.use(morgan('dev'));
              app.use(express.json());
              app.use(express.urlencoded({ extended: false }));
              app.use(cookieParser());

              // TODO: improve
              if(user.score.dir.static) {
                // NOTE: static should be defined in user Applications
                app.use(express.static(user.score.dir.static));
                // NOTE: css middleware
                if (user.score.dir.assets){
                  if (root.utility.check.isObject(user.score.sassMiddleWare)){
                    // TODO: reading custom scss and css
                    user.score.sassMiddleWare.src=rootRequest.path.resolve(user.score.dir.assets, 'scss');
                    user.score.sassMiddleWare.dest=rootRequest.path.resolve(user.score.dir.static,'css');
                    app.use(sassMiddleWare(user.score.sassMiddleWare));
                  }
                }
              }
              // NOTE: routing must be defined in user Applications
              user(app);
              // rootSetting.listening[dirName]=new Array();
              // virtualHost[dirName].forEach((k:string)=>applications.use(vhost(k, app),rootSetting.listening[dirName].push(k)));

              // NOTE: vhost
              if(root.utility.check.isArray(virtualHost[dirName])) {
                virtualHost[dirName].forEach((k:string)=>applications.use(vhost(k, app)));
                rootSetting.listening[dirName]=virtualHost[dirName];
              }
              console.log(rootSetting.Ok,user.score.name);
              // NOTE: catch 404 and forward to error handler
              app.use((req?:any, res?:any, next?:any) => next(httpErrors(404)));

              // NOTE: error handler
              // app.use(function(err?:any, req?:any, res?:any, next?:any) {
              //   // NOTE: set locals, only providing error in development
              //   res.locals.message = err.message;
              //   res.locals.error = req.app.get('env') === 'development' ? err : {};
              //   // NOTE: render the error page
              //   res.status(err.status || 500);
              //   res.render('error');
              //   // res.status(404).send('Sorry, we cannot find that!');
              //   // res.redirect(301, '/');
              //   // console.log(req.path);
              //   // res.redirect(307,'/');
              //   // res.render('index');
              //   next();
              // });
            } catch (e) {
              console.log(e);
            }
          }
        }
      }
    }
  }
};