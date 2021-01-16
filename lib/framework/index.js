'use strict';

// @ts-check
import * as path from "path";
import * as events from 'events';
import createServer from "./createServer.js";
import {Router} from "./router.js";
import * as $ from "./config.js";
import aid from "../aid/index.js";
import mysql from '../database/mysql.js';
import mongo from '../database/mongo.js';

var rootCommon = aid.seek.directory(process.argv[1]);
/**
 * init
 */
export class InitialConfiguraiton{
  // constructor(){
  //   this.loadConfiguration();
  // }

  loadConfiguration(){
    if ($.starter.env) {
      const env = aid.load.env(rootCommon, $.starter.env);
      const _allowed = Object.keys($.environment);

      if (Object.keys(env).length) {
        $.starter.env = '';
      }

      Object.assign(
        $.user,
        Object.keys(env).filter(
          e => !_allowed.includes(e)
        ).reduce(
          (o, i) => Object.assign(({[i]: env[i]}),o), {}
        )
      );
      Object.assign($.environment, env);
    }

    this.loadPackage();
  }

  loadPackage() {
    $.user.development = !process.env.NODE_ENV || process.env.NODE_ENV.trim() != 'production';
    // process.env.NODE_ENV || 'development';

    if (!$.user.name) {
      const pkg = aid.load.json(rootCommon,$.starter.json);
      $.user.name = pkg.name;
      $.user.description = pkg.description;
      $.user.version = pkg.version;
    }

    if ($.user.restrict && typeof $.user.restrict == 'string') {
      $.user.restrict = aid.parse.context($.user.restrict);
    }
    if ($.user.listen && typeof $.user.listen == 'string') {
      $.user.listen = aid.parse.context($.user.listen);
    }
    if ($.user.referer && typeof $.user.referer == 'string'){
      $.user.referer = aid.fire.array.unique($.user.referer.split(';')).map(aid.parse.hostNameRegex);
    }

    if (!$.user.dir.root || $.user.dir.root != rootCommon){
      $.user.dir = {
        root:rootCommon,
        static: path.resolve(rootCommon,$.user.dir.static),
        assets: path.resolve(rootCommon,$.user.dir.assets),
        views: path.resolve(rootCommon,$.user.dir.views),
        routes: path.resolve(rootCommon,$.user.dir.routes)
      };
    }

    if($.environment.mysqlConnection) {
      db.mysql.config = $.environment.mysqlConnection;
      if(db.mysql.factor && db.mysql.pool == null) {
        db.mysql.connect().catch(console.log);
      }
    }

    if($.environment.mongoConnection) {
      db.mongo.config = $.environment.mongoConnection;
      if(db.mongo.factor && db.mongo.pool == null) {
        db.mongo.connect().catch(console.log);
      }
    }
  }

  /**
   * @param  {any} directory
   */
  root(...directory){
    rootCommon = aid.seek.directory(directory);
  }

  /**
   * @param  {string} name
   */
  port(name){
    $.user.listen.port = name;
  }

  /**
   * @param  {string} name
   */
  hostname(name){
    $.user.listen.host = name;
  }

  /**
   * @param  {any} o
   */
  config(o){
    if (o && o.config instanceof Object) Object.assign($.user, o.config);
  }

  /**
   * @param  {any} factor
   */
  mysql (factor) {
    db.mysql.factor = factor;
  }

  /**
   * @param  {any} factor
   */
  mongo(factor) {
    db.mongo.factor = factor;
  }
}

export const db = {
  /**
   * @type {mysql} mysql
   */
  mysql: new mysql(),
  /**
   * @type {mongo} mongo
   */
  mongo: new mongo()
};

export const config = $;
export const init = new InitialConfiguraiton();

/**
 * @property string routeId
 * @property string routePrefix
 *
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
    if (!$.route.name.includes(this.routeId)) $.route.name.push(this.routeId);
  }
}

class Core extends Router {

  constructor() {
    super();
    init.loadConfiguration();
  }

  /**
   * test Memory usage
   */
  memoryUsage() {
    return process.memoryUsage();
    // for (var k in useds) console.log(`${k} ${Math.round(useds[k] / 1024 / 1024 * 100) / 100} MB`);
  }

  /**
   * @param {string} routeId
   * @param {string} routePrefix
   */
  route(routeId='',routePrefix=''){
    return new Route(routeId,routePrefix);
  }

  get config(){
    return $.user;
  }

  set config(o){
    init.config(o)
  }

  get db(){
    return db;
  }
}

/**
 * @extends Core
 */
export class Command extends Core {
  req = { method:'get', url:aid.parse.cli($.Params),pathname:'', params:{}, query:{} };
  evt = new events.EventEmitter();

  // constructor() { super(); }

  execute(){
    this.evt.emit('request', this.req);
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
 * @property {createServer} server;
 * @type {createServer} server;
 */
export class Server extends Core {
  server = createServer();

  // constructor() { super(); }

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