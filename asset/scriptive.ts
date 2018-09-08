import './essential';
import * as database from './database';

const express = require('express');
const environments = require('dotenv');
const debug = require('debug')('http');
const vhost = require('vhost');
const {Server, createServer} = require('http');
// import {Server, createServer} from 'http';
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const sassMiddleWare = require('node-sass-middleware');
const httpErrors = require('http-errors');

const applications = express();
// TODO: expressVirtual,express,environments,debug
// NOTE: environments.config({path: path.join(__dirname,'.env')});
export namespace serve {
  export class http {
    private server?:any;
    private bind?:any;
    constructor() {
      if (!rootConfiguration.hasOwnProperty('root')) this.root();
    }
    test(){
      console.log('Ok expressVirtual');
    }
    root(dir?:string) {
      rootConfiguration.root = dir || process.mainModule.paths[0].split('node_modules')[0].slice(0, -1);
    }
    port(port?:string) {
      // NOTE: Normalize a port into a number, string, or false.
      if (port) return rootConfiguration.port = port;

      let k = rootConfiguration.port;
      rootConfiguration.port = parseInt(k, 10);
      if (isNaN(rootConfiguration.port)) {
        // NOTE: named pipe
        rootConfiguration.port = k;
      } else if(rootConfiguration.port <= 0) {
        // NOTE: port number
        rootConfiguration.port = false;
      }
    }
    main(main?: string){
      rootConfiguration.main = main || rootConfiguration.main;
    }
    start() {
      // environments.config();
      const env = environments.parse(fs.readFileSync(path.join(rootConfiguration.root,'config.env')))
      rootConfiguration.merge(env);
      this.port();

      try {
        this.virtualHost();
      } catch (e) {
        console.error(e);
      } finally {
        applications.set('port', rootConfiguration.port);
      }
      // this.server = http.createServer(applications);
      this.server = createServer(applications);
      this.server.listen(rootConfiguration.port);
      //
      let address = this.server.address();
      this.bind = typeof address === 'string'?'pipe:' + address:'port:' + address.port;
      return this.server;
    }
    // virtualHost() {}
    virtualHost() {
      rootConfiguration.dir.app=path.join(rootConfiguration.root,rootConfiguration.app);
      rootConfiguration.dir.share=path.join(rootConfiguration.root,rootConfiguration.share);
      rootConfiguration.listening={};
      // NOTE: available Application rootConfiguration
      if (fs.existsSync(rootConfiguration.dir.app)) {
        fs.readdirSync(rootConfiguration.dir.app).forEach((dirName:string)=>{
          if (rootConfiguration.hasOwnProperty(dirName)) {
            rootConfiguration[dirName].split(',').forEach((Domain:string)=>{
              let appMain = path.join(rootConfiguration.dir.app,dirName,rootConfiguration.main);
              if (fs.existsSync(appMain)) {
                try {
                  const app = express();
                  const user = require(appMain);
                  // NOTE: environments
                  const score = environments.parse(fs.readFileSync(path.join(rootConfiguration.dir.app,dirName,'config.env')));

                  if (!score.hasOwnProperty('name')) score.name=name;
                  if (!score.hasOwnProperty('version')) score.name='1.0';

                  if (rootConfiguration.listening.hasOwnProperty(dirName)){
                    rootConfiguration.listening[dirName].push(Domain)
                  } else {
                    rootConfiguration.listening[dirName]=new Array(Domain);
                    console.log('[Ok] '+score.name);
                  }
                  // NOTE: directory
                  score.dir={
                    root: rootConfiguration.root,
                    share: rootConfiguration.dir.share,
                    app: path.join(rootConfiguration.dir.app,dirName),

                    public: path.join(rootConfiguration.dir.app,dirName,'public'),
                    assets: path.join(rootConfiguration.dir.app,dirName,'assets'),
                    views: path.join(rootConfiguration.dir.app,dirName,'views'),
                    routes: path.join(rootConfiguration.dir.app,dirName,'routes')
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
                  if(user.score.dir.public) {
                    // NOTE: css middleware
                    if (user.score.dir.assets){
                      let sassMiddleWareOption:any = {
                        src: path.join(user.score.dir.assets, 'scss'),
                        dest: path.join(user.score.dir.public,'css'),
                        // prefix: '/css',
                        indentedSyntax: false,
                        debug: false,
                        response:false,
                        // NOTE: nested, expanded, compact, compressed -->outputStyle: 'compressed',
                        sourceMap: false
                      };
                      if (user.hasOwnProperty('sassMiddleWare')){
                        if (user.sassMiddleWare) {
                          rootObject.merge(sassMiddleWareOption,user.sassMiddleWare);
                        } else {
                          sassMiddleWareOption=false;
                        }
                      }
                      if (sassMiddleWareOption) app.use(sassMiddleWare(sassMiddleWareOption));
                    }
                    // NOTE: static should be defined in user Applications
                    app.use(express.static(user.score.dir.public));
                  }

                  // NOTE: routing must be defined in user Applications
                  user(app);
                  // NOTE: vhost
                  applications.use(vhost(Domain, app));
                  // NOTE: catch 404 and forward to error handler
                  app.use(function(req?:any, res?:any, next?:any) {
                    next(httpErrors(404));
                  });

                  // NOTE: error handler
                  app.use(function(err?:any, req?:any, res?:any, next?:any) {
                    // NOTE: set locals, only providing error in development
                    res.locals.message = err.message;
                    res.locals.error = req.app.get('env') === 'development' ? err : {};
                    // NOTE: render the error page
                    res.status(err.status || 500);
                    res.render('error');
                    // res.status(404).send('Sorry, we cannot find that!');
                    // res.redirect(301, '/');
                    // console.log(req.path);
                    // res.redirect(307,'/');
                    // res.render('index');
                    next();
                  });
                } catch (e) {
                  console.log(e);
                }
              }
            });
          }
        });
      } else {
        throw '[No] app directory found';
      }
    }
    error(callback?:any) {
      // NOTE: Event listener for HTTP server "error" event.
      this.server.on('error', (e:any)=>{
        if (e.syscall !== 'listen')throw e;
        let bind = this.bind;
        // NOTE: handle specific listen errors with friendly messages
        switch (e.code) {
          case 'EACCES':
            if (callback && callback instanceof Function) {
              callback(bind + ' requires elevated privileges');
            } else {
              console.error(bind + ' requires elevated privileges');
            }
            process.exit(1);
          break;
          case 'EADDRINUSE':
            if (callback && callback instanceof Function) {
              callback(bind + ' is already in use');
            } else {
              console.error(bind + ' is already in use');
            }
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
        if (callback && callback instanceof Function) {
          callback(this);
        } else {
          console.log('listening on ' + this.bind);
          // console.log(rootConfiguration.listening);
        }
      });
    }
  }
}