import * as root from './essential';
import * as nav from './nav';
// export const navMiddleWare = nav.middleware;
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

// const compression = require('compression')

// NOTE: environments.config({path: rootRequest.path.join(__dirname,'.env')});
// TODO: multi ports configuration
const applications = express();

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
export class navMiddleWare extends nav.middleware {
};
const callbackListening = () => {
  console.log('listening on',rootSetting.bind,Object.keys(rootSetting.listening).length == 0?'but no app were found!':'');
},
callbackError = (e:any) => {
  if (e.syscall !== 'listen')throw e;
  // NOTE: handle specific listen errors with friendly messages
  switch (e.code) {
    case 'EACCES':
      console.error(rootSetting.bind,'requires elevated privileges'); process.exit(1);
    break;
    case 'EADDRINUSE':
      console.error(rootSetting.bind,'is already in use'); process.exit(1);
    break;
    default:
      throw e;
  }
},
callbackClose = () => {
  console.log(`...successfully closed!`);
},
callbackLog = (severity?:any, key?:string, val?:string, text?:string) => {
  // console.log(`...successfully closed!`);
  // og('debug', 'skip', path, 'nothing to do');
  // severity?:any, key?:string, val?:string, text?:string
  // \u001b[32;1m
  // console.log('[www]  \x1B[90m%s:\x1B[0m \u001b[32;1m%s %s\x1B[0m', key, val, text);
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

              // NOTE: to be continuous using uglify-es
              // nodeMinify.minify({
              //   compressor: 'uglify-es',
              //   // input: 'foo.js',
              //   input: rootRequest.path.join(user.score.dir.assets,'script/*.js'),
              //   // output: './static/bar.js',
              //   output: rootRequest.path.join(user.score.dir.static,'node-minify.js'),
              //   // output: rootRequest.path.resolve(user.score.dir.static,'node-minify.js'),
              //   callback: (err:any, min:any)=> {
              //     // if (err)console.log(err);
              //     // console.log(min);
              //   }
              // });
              // TODO: improve (position,installation,making var)
              // NOTE: database
              user.app.use((req?:any, res?:any, next?:any) => {
                if (user.score.hasOwnProperty('mysqlConnection')) user.score.sql = new database.connection.mysql(user.score.mysqlConnection);
                next();
              });
              user.app.set('views', user.score.dir.views);
              user.app.set('view engine', 'pug');
              user.app.use(morgan('dev'));
              user.app.use(express.json());
              user.app.use(express.urlencoded({ extended: false }));
              user.app.use(cookieParser());

              // user.app.use(compression());

              // TODO: improve (conditionals, installation)
              if (user.score.dir.static) {
                // NOTE: css middleware
                if (user.score.dir.assets){
                  if (rootValidate.isObject(user.score.sassMiddleWare)){
                    // TODO: reading custom scss and css
                    user.score.sassMiddleWare.src=rootRequest.path.resolve(user.score.dir.assets, 'scss');
                    user.score.sassMiddleWare.dest=rootRequest.path.resolve(user.score.dir.static,'css');
                    user.app.use(sassMiddleWare(user.score.sassMiddleWare));
                  }
                  user.app.use((req?:any, res?:any, next?:any) => {
                    // if (req.method !== 'GET' && req.method !== 'HEAD') {
                    //   return next();
                    // }
                    //
                    // var path = url.parse(req.url).pathname;
                    //
                    // if (!/\.js$/.test(path)) {
                    //   log('debug', 'skip', path, 'nothing to do');
                    //   return next();
                    // }
                    next();
                  });
                }
                // NOTE: static should be defined in user Applications
                user.app.use(express.static(user.score.dir.static));
              }
              var nav = new navMiddleWare(user);
              user.app.use(nav.register());
              user.nav = (Id:string)=>nav.insert(Id);
              // NOTE: routing must be defined in user Applications
              user(user);
              // NOTE: vhost
              if (rootValidate.isArray(virtualHost[dirName])) {
                virtualHost[dirName].forEach((k:string)=>applications.use(vhost(k, user.app)));
                rootSetting.listening[dirName]=virtualHost[dirName];
              }
              console.log(rootSetting.Ok,user.score.name);
              // NOTE: catch 404 and forward to error handler
              user.app.use((req?:any, res?:any, next?:any) => next(httpErrors(404)));

              // TODO: decide whether to include in production
              // NOTE: error handler
              // user.app.use((err?:any, req?:any, res?:any, next?:any) => {
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