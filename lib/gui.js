import {Server,db,config} from "./framework/index.js";
import * as handler from "./framework/handler.js";
import aid from "./aid/index.js";

/**
 * Application - user interface
 * namespace
 */
const app = new Server();

app.on('request',
  async (req, res) => {

    req.route = aid.parse.url(req.url);

    try {
      for (const mwa of handler.middleware(req)) {
        await handler.filter(mwa.callback, req, res);
      }

      const route = handler.route(req);

      if (route) {
        // let body = await readBody(req);
        // if (this.parseMethod === "json") {
        //   body = body ? JSON.parse(body) : {};
        // }
        // req.body = body;

        // res.locals.appName = config.user.name;
        // res.locals.appVersion = config.user.version;
        // res.locals.appDescription = config.user.description;

        // console.log(req.headers,req.url);
        // var protocol = req.headers['upgrade-insecure-requests'] == 1?'':'s';
        // res.locals.host = 'http'+protocol+'://'+req.headers.host;
        // if (req.headers.referer){
        //   var ref = aid.parse.url(req.headers.referer);
        //   res.locals.referer = req.headers.host == ref.host;// || config.user.referer.filter((e)=>e.exec(ref.host)).length > 0;
        //   res.locals.host = ref.protocol+'//'+req.headers.host;
        // }

        await handler.filter(route.middleware, req, res);

        for (const name of config.route.name) {
          if(name) res.locals[name]=config.route.menu.filter(e=>e.group == name && e.text);
        }

        var response = route.callback(req,res);
        if (response instanceof Promise){
          await response;
        }
      } else {
        throw new Error('Not found');
      }
    } catch (error) {
      res.status(500).send(error.message);
    }
  }
);

// NOTE: set port
// process.env.HOST = $.config.user.listen.host;

// NOTE: set host
// process.env.PORT = $.config.user.listen.port.toString();

// NOTE: on listen
// app.on('listening',() => {
//   console.log('$.config.route.name',config.route.name);
//   console.log('$.config.route.menu',config.route.menu);
//   console.log('$.config.route.list',config.route.list);
// });

// NOTE: on error
// app.on('error',(e) => console.log('...',e));

// NOTE: on exit
app.on('close',() => db.mysql.close());

export default () => app;