'use strict';

// @ts-check
import * as events from 'events';
import {loadConfiguration, InitialConfiguraiton, default as $} from "./initial.js";
// import {Request, Response, default as createServer} from "./createServer.js";
import * as http from "./http.js";
import {Router} from "./router.js";
import aid from "../aid/index.js";

export const db = $.db;
export const config = $.config;
export const init = new InitialConfiguraiton();

/**
 * @property string routeId - apple
 * @property string routePrefix
 */
export class Route extends Router {
  /**
   * @param {string} routeId
   * @param {string} routePrefix
   */
  constructor(routeId='',routePrefix='') {
    super();
    if (routeId) this.routeId = routeId;
    if (routePrefix) this.routePrefix = routePrefix;
    if (!$.config.route.name.includes(this.routeId)) $.config.route.name.push(this.routeId);
  }
}

/**
 * @param {string} routeId - Used in Navigator
 * @param {string} routePrefix - root path for current route
 */
export const route = (routeId='',routePrefix='') => new Route(routeId,routePrefix);

class Core extends Router {

  constructor() {
    super();
    this.route = route;
    loadConfiguration();
  }

  /**
   * test Memory usage
   */
  memoryUsage() {
    return process.memoryUsage();
    // for (var k in useds) console.log(`${k} ${Math.round(useds[k] / 1024 / 1024 * 100) / 100} MB`);
  }

  get config(){
    return $.config.user;
  }

  set config(o){
    init.config(o)
  }

  get db(){
    return $.db;
  }
}

/**
 * @extends Core
 */
export class Command extends Core {

  req = {
    method:'get',
    url:aid.parse.cli($.config.Params),
    pathname:'',
    params:{},
    query:{},
    route:{}
  };

  evt = new events.EventEmitter();

  /**
   * @param {() => void} listener - is executed upon complete as a callback
   */
  execute(listener=()=>null){
    this.evt.emit('request', this.req, listener);
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
  on(...rest){
    return this.evt.on.apply(this.evt,rest);
  }

  close(){
    this.evt.emit('close', true);
  }

}

/**
 * @extends Core
 */
export class Server extends Core {

  get server() {
    return http.server();
  }

  refresh(listener=()=>null) {
    return http.refresh(listener);
  }

  /**
   * @param {string} method
   */
  bodyParse(method) {
    return this.parseMethod = method;
  }

  get address(){
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
  listen(...rest){
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
  on(event,listener){
    return this.server.on(event, listener);
  }

  /**
   * @param {any} rest arguments (callback)
   */
  close(...rest){
    this.server.close.apply(this.server, rest);
  }

}