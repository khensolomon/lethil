// @ts-check
import {Command,db} from "./framework/index.js";
import * as handler from "./framework/handler.js";
import aid from "./aid/index.js";

/**
 * Application - command line interface
 * @namespace
 */
export default function app(){
  const core = new Command();

  // NOTE: on execute/listen
  // core.on('executing',function() {
  //   console.log('$.config.route.name',$.config.route.name);
  //   console.log('$.config.route.menu',$.config.route.menu);
  //   console.log('$.config.route.list',$.config.route.list);
  // });

  // NOTE: on request
  core.on('request',async (req,callback) => {

    req.route = aid.parse.url(req.url);
    req.pathname = req.route.pathname;

    try {
      for (const mwa of handler.middleware(req)) {
        await handler.filter(mwa.callback, req);
      }

      const route = handler.route(req);
      if (route) {
        await handler.filter(route.middleware, req);

        var response = route.callback(req);
        if (response instanceof Promise){
          response = await response;
        }
        core.evt.emit('success', response);
      } else {
        throw new Error('Not found');
      }
    } catch (error) {
      core.evt.emit('error', error.message);
    }
    callback();
  });

  // NOTE: on success
  // core.on('success', e => console.log('...',e));

  // NOTE: on error
  // core.on('error', e => console.log('...',e));

  // NOTE: on exit
  core.on('close',() => db.mysql.close());

  return core;
}
