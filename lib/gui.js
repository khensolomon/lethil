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
 * @returns {Server}
 */
export default function () {
  if (!app) {
    app = new Server();
    // app.use(app.static("static"));
    // app.use((req, res, next) => {
    //   const url_parsed = url.parse(req.originalUrl);
    //   // console.log("url_parsed", url_parsed);

    //   // const abc = $.route.menu.find((e) => e.url == url_parsed.pathname);
    //   $.route.nav = {};
    //   for (let index = 0; index < $.route.menu.length; index++) {
    //     const elm = $.route.menu[index];
    //     elm.class = "";
    //     console.log("pathname", elm.url, url_parsed.pathname);
    //     if (elm.url == url_parsed.pathname) {
    //       elm.class = "current";
    //     } else if (url_parsed.pathname?.startsWith(elm.url) && elm.url != "/") {
    //       elm.class = "active";
    //     }
    //     if ($.route.nav.hasOwnProperty(elm.group)) {
    //       $.route.nav[elm.group].push(elm);
    //     } else {
    //       $.route.nav[elm.group] = [elm];
    //     }
    //   }
    //   res.locals.nav = $.route.nav;
    //   next();
    // });
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
