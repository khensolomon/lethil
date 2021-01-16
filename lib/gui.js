// @ts-check
import {Server,db,config} from "./framework/index.js";
import {routeActive, filter} from "./framework/middleware.js";

const app = new Server();

app.on('request', async (req, res) => {
  const route = routeActive(req);

  if (route){

    // let body = await readBody(req);
    // if (this.parseMethod === "json") {
    //   body = body ? JSON.parse(body) : {};
    // }
    // req.body = body;

    try {
      for (const mwa of config.route.middleware.concat({path:'',callback:route.middleware})) {
        await filter(mwa.callback, req, res);
      }

      const response = route.callback(req,res);
      if (response instanceof Promise){
        await response;
      }
    } catch (error) {
      res.status(500).send(error.message);
    }
  } else {
    res.status(404).send('Not found');
  }
});

// NOTE: middleware
// $.config.Core.use((req:any, res:any, next:any) => {
//   res.locals.appName = $.config.user.name;
//   res.locals.appVersion = $.config.user.version;
//   res.locals.appDescription = $.config.user.description;
//   if (req.get('Referrer')){
//     var ref_hostname = aid.hostNameExec(req.get('Referrer'));
//     res.locals.referer = req.hostname == ref_hostname || $.config.user.referer.filter((e:RegExp)=>e.exec(ref_hostname)).length
//   }
//   next();
// });


// NOTE: set port
// process.env.HOST = $.config.user.listen.host;

// NOTE: set host
// process.env.PORT = $.config.user.listen.port.toString();

// NOTE: on listen
// app.on('listening',() => {
//   console.log('$.config.route.name',$.config.route.name);
//   console.log('$.config.route.menu',$.config.route.menu);
//   console.log('$.config.route.list',$.config.route.list);
// });

// NOTE: on error
app.on('error',(e) => {
  console.log('...',e)
});

// NOTE: on exit
app.on('close',() => {
  db.mysql.close();
});

export default ()=>app;