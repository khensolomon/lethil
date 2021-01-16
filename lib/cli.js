// @ts-check
import {Command,db,config} from "./framework/index.js";
import {routeActive, filter} from "./framework/middleware.js";

// NOTE: core
// var fn = 'main';
// if (aid.seek.directory(process.argv[1]) == $.config.user.dir.root) {
//   if ($.config.Params.length) fn = $.config.Params[0];
// }
const app = new Command();

// NOTE: on execute/listen
// app.on('executing',function() {
//   console.log('$.config.route.name',$.config.route.name);
//   console.log('$.config.route.menu',$.config.route.menu);
//   console.log('$.config.route.list',$.config.route.list);
// });

// NOTE: on request
app.on('request',async (req, res) => {
  const route = routeActive(req);

  if (route){
    try {
      for (const mwa of config.route.middleware.concat({path:'',callback:route.middleware})) {
        await filter(mwa.callback, req, res);
      }

      var response = route.callback(req);
      if (response instanceof Promise){
        response = await response;
      }
      app.evt.emit('success', response);
    } catch (error) {
      app.evt.emit('error', error);
    }
  } else{
    app.evt.emit('error', 'no Method found');
  }
});

app.on('success',function(e) {
  console.log('...',e)
});

// NOTE: on error
app.on('error',function(e) {
  console.log('...',e)
});

// NOTE: on exit
app.on('close',function() {
  db.mysql.close();
});

export default () => app;
