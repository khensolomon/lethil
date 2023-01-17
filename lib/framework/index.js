import { EventEmitter } from "events";
import {
  loadEnvironment,
  PrepareEnvironment,
  default as $,
} from "./initial.js";
// import {Request, Response, default as createServer} from "./createServer.js";
import * as http from "./http.js";
import { Router } from "./router.js";
import aid from "../aid/index.js";

export const db = $.db;
export const config = $.config;

/**
 *
 * @type {PrepareEnvironment}
 */
export const init = new PrepareEnvironment();

/**
 * @property string routeId - apple
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
    if (!$.config.route.name.includes(this.routeId))
      $.config.route.name.push(this.routeId);
  }
}

/**
 * @param {string} routeId - Used in Navigator
 * @param {string} routePrefix - root path for current route
 */
export const route = (routeId = "", routePrefix = "") =>
  new Route(routeId, routePrefix);

class Core extends Router {
  constructor() {
    super();
    this.route = route;
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

  set config(o) {
    init.config(o);
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

  /** type {EventEmitter} */
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
   * app.on('executing', (e) => console.log(e));
   * app.on('success', (e) => console.log(e));
   * app.on('error', (e) => console.log(e));
   * app.on('close', () => console.log('closed'));
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
   * param {any} rest arguments (evt, listener)
   * param {[event: "listening", listener: (...args: any[]) => void]} rest
   * param {[event: "close", listener: () => void]} rest
   * param {[event: "connection", listener: (socket: any) => void]} rest
   * param {[event: "error", listener: (err: Error) => void]} rest
   * param {[event: string, listener: (...args: any[]) => void]} rest
   * @example
   * app.on('listening', (e) => console.log(e));
   * app.on('connection', (e) => console.log(e));
   * app.on('error', (e) => console.log(e));
   * app.on('close', () => console.log('closed'));
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
