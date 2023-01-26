import { EventEmitter } from "events";
import {
  loadEnvironment,
  prepareEnvironment,
  default as $,
} from "./initial.js";
import * as http from "./http.js";
import { Router, routeURI } from "./router.js";
import aid from "../aid/index.js";

export const db = $.db;
export const config = $.config;

/**
 *
 * @type {prepareEnvironment}
 */
export const init = prepareEnvironment;

/**
 * Primary route for (GUI & CLI)
 * @extends Router
 * @property string routeId - home
 * @property string routePrefix
 */
export class Route extends Router {
  /**
   * @param {string} routeId
   * @param {string} routePrefix
   */
  constructor(routeId = "", routePrefix = "") {
    super();
    if (routeId) this.routeId = routeId;
    if (routePrefix) this.routePrefix = routePrefix;
    if (!config.route.name.includes(this.routeId))
      config.route.name.push(this.routeId);
  }
}

/**
 * route for Graphical user interface(Web)
 * @extends Route
 */
class RouteGui extends Route {
  /**
   * @todo ?
   * @ignore todo
   * param {...any} rest
   * param {...{url:string, rest:any}|{rest:any}} rest
   * param {...http.Middleware} rest
   * param {...({name:string,rest:http.Middleware}|{rest:http.Middleware})} rest
   * @param {...(http.Middleware|string)} rest
   */
  use(...rest) {
    var name = "";
    var mwa = rest[0];
    if (rest.length > 1) {
      // @ts-ignore
      name = rest[0];
      mwa = rest[1];
    }

    if (typeof mwa == "function") {
      config.route.middleware.push({
        url: routeURI(this.routePrefix, name),
        callback: mwa,
      });
    }
  }
  /**
   * @param { string | {url:string, text:string, route:string} } url - {@link TypeOfRouteRest}
   * @param {...http.TypeOfRouteRestGui } rest
   */
  get(url, ...rest) {
    this.dispatch("get", url, rest);
  }

  /**
   * @param { string | {url:string, text:string, route:string} } url
   * @param {...http.TypeOfRouteRestGui } rest
   */
  post(url, ...rest) {
    this.dispatch("post", url, rest);
  }

  /**
   * @param { string | {url:string, text:string, route:string} } url
   * @param {...http.TypeOfRouteRestGui } rest
   */
  put(url, ...rest) {
    this.dispatch("put", url, rest);
  }

  /**
   * @param { string | {url:string, text:string, route:string} } url
   * @param {...http.TypeOfRouteRestGui } rest
   */
  delete(url, ...rest) {
    this.dispatch("delete", url, rest);
  }
}

/**
 * route for Command-line interface
 * @extends Route
 */
class RouteCli extends Route {
  /**
   * @param { string } url - {@link TypeOfRouteRest}
   * @param {...http.TypeOfRouteRestCli } rest
   */
  get(url, ...rest) {
    this.dispatch("get", url, rest);
  }
}

/**
 * @param {string} routeId - Used in Navigator
 * @param {string} routePrefix - root path for current route
 */
// export const route = (routeId = "", routePrefix = "") =>
//   new Route(routeId, routePrefix);
// export function route(routeId = "", routePrefix = "") {
//   if (routeId || routePrefix) {
//     return new RouteGui(routeId, routePrefix);
//   }
//   return new RouteCli(routeId, routePrefix);
// }

export const route = {
  cli: RouteCli,
  gui: RouteGui,
};

class Core extends Router {
  constructor() {
    super();
  }

  /**
   * load .env and package.json
   */
  environment() {
    loadEnvironment();
  }

  /**
   * test Memory usage
   * @example
   * const usage = memoryUsage()
   * for (var k in usage) console.log(`${k} ${Math.round(usage[k] / 1024 / 1024 * 100) / 100} MB`);
   */
  memoryUsage() {
    return process.memoryUsage();
  }

  get config() {
    return $.config.app;
  }

  get db() {
    return $.db;
  }
}

/**
 * @extends Core
 */
export class Command extends Core {
  constructor() {
    super();
  }

  req = {
    method: "get",
    url: aid.parse.cli($.config.Params),
    pathname: "",
    params: {},
    query: {},
    route: {},
  };

  /**
   * @type {EventEmitter}
   */
  evt = new EventEmitter();

  /**
   * @param {() => void} listener - is executed upon complete as a callback
   */
  execute(listener = () => null) {
    this.evt.emit("request", this.req, listener);
  }

  /**
   * @param {[event: string | symbol, listener: (...args: any[]) => void]} rest
   * {any} rest arguments (evt, listener)
   * @example
   * .on('executing', console.log);
   * .on('success', (e) => console.log(e));
   * .on('error', (e) => console.log(e));
   * .on('close', () => console.log('closed'));
   */
  on(...rest) {
    return this.evt.on.apply(this.evt, rest);
  }

  close() {
    this.evt.emit("close", true);
  }
}

/**
 * @extends Core
 */
export class Server extends Core {
  constructor() {
    super();
  }

  /**
   * returns {http.Server}
   * returns {http.Server}
   */
  get server() {
    return http.server();
  }

  /**
   * @param {() => null} listener - refresh
   * returns {http.Server}
   */
  refresh(listener = () => null) {
    return http.refresh(listener);
  }

  /**
   * @param {string} method
   */
  bodyParses(method) {
    return (this.parseMethod = method);
  }

  /**
   * returns {string | AddressInfo | null}
   * @returns {any}
   */
  get address() {
    return this.server.address.apply(this.server);
  }

  /**
   * @param {any} rest arguments (port, host, listener) ({}, listener)
   * @example
   * listen({port:80,host:0.0.0.0},()=>console.log('Ok'));
   * listen(81,'locahost',()=>console.log('Ok'));
   * type {string} port
   * param {string} hostname
   * param {void} listener
   * param {[handle: any, listeningListener?: (() => void) | undefined]}
   */
  listen(...rest) {
    return this.server.listen.apply(this.server, rest);
  }

  /**
   * @param {string} event
   * @param {(...args: any[]) => void} listener
   * @example
   * app.on('listening', (e) => console.log(e));
   * app.on('connection', (e) => console.log(e));
   * app.on('error', (e) => console.log(e));
   * app.on('close', (e) => console.log('closed',e));
   *
   * param {any} rest arguments (evt, listener)
   * param {[event: "listening", listener: (...args: any[]) => void]} rest
   * param {[event: "close", listener: () => void]} rest
   * param {[event: "connection", listener: (socket: any) => void]} rest
   * param {[event: "error", listener: (err: Error) => void]} rest
   * param {[event: string, listener: (...args: any[]) => void]} rest
   */
  on(event, listener) {
    return this.server.on(event, listener);
  }

  /**
   * @param {any} rest arguments (callback)
   */
  close(...rest) {
    this.server.close.apply(this.server, rest);
  }
}
