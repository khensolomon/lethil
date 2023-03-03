import { Command } from "./framework/command.js";
import * as handler from "./framework/handler.js";

/**
 * @namespace
 * @type {Command}
 */
var app;

/**
 * Application - command line interface
 * @returns {Command}
 */
export default function command() {
  if (!app) {
    app = new Command();

    app.on("listen", async (req, callback) => {
      // req.route = aid.parse.url(req.url);
      // req.query = req.route.query;

      try {
        const route = handler.route(req);
        if (route) {
          var res = route.callback(req);
          if (res instanceof Promise) {
            res = await res;
          }
          callback(res);
        } else {
          app.evt.emit("error", "No route exists: " + req.route.pathname);
        }
      } catch (/** @type {any}*/ error) {
        app.evt.emit("error", error.message || error);
      }
      process.exit(0);
    });
  }

  // NOTE: on success
  // app.on("success", (e) => console.log("...", e));

  // NOTE: on error
  // app.on("error", (e) => console.log("...", e));

  // NOTE: on exit
  // app.on("done", () => db.mysql.close());
  // process.on("exit", function () {});
  return app;
}
