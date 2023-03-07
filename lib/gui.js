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
  return app;
}
