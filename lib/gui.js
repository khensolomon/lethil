// import url from "url";
// import * as $ from "./framework/index.js";
import { Server } from "./framework/server.js";

/**
 * @namespace
 * @type {Server}
 */
var app;
/**
 * Application - user interface
 *
 * It's all begin with your's app
 * @returns {Server}
 */
export default function () {
  if (!app) {
    app = new Server();
  }

  // NOTE: set port
  // process.env.HOST = $.config.app.listen.host;

  // NOTE: set host
  // process.env.PORT = $.config.app.listen.port.toString();

  // NOTE: on listen
  // app.on('listening',() => {
  //   console.log('$.config.route.name',config.route.name);
  //   console.log('$.config.route.menu',config.route.menu);
  //   console.log('$.config.route.list',config.route.list);
  // });

  // NOTE: on error
  // app.on('error',(e) => console.log('...',e));

  // NOTE: on exit
  // app.on("close", () => db.mysql.close());
  return app;
}
