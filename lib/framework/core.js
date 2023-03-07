import * as $ from "./env.js";
import aid from "../aid/index.js";
import mysql from "../database/mysql.js";
import mongo from "../database/mongo.js";

/**
 * root directory of dependents project,
 * each process manager has it's own dir configuration
 * but dependents wanted it static root dir
 * @example
 * import core from "lethil";
 * core.set("root", process.cwd());
 */
var rootCommon = aid.seek.directory(process.argv[1]);

/**
 * init InitiateConfiguration
 * @class
 */
class InitiateConfiguration {
  /**
   * @param  {any} directory
   */
  root(...directory) {
    rootCommon = aid.seek.directory(directory);
  }

  /**
   * @param  {string} name
   */
  port(name) {
    $.app.listen.port = name;
  }

  /**
   * @param  {string} name
   */
  hostname(name) {
    $.app.listen.host = name;
  }

  /**
   * @template T
   * @param  { T } o
   * @returns { $.app & T }
   */
  merge(o) {
    // if (o && o.config instanceof Object) Object.assign($.app, o.config);
    // if (o && o.setting instanceof Object) Object.assign(o.setting,Object.assign($.app,o.setting));

    // if (aid.check.isObject(o)) {
    //   return aid.fire.object.merge($.app, o);
    //   // Object.assign(o, Object.assign($.app, o));
    // }
    // return $.app;
    return aid.fire.object.merge($.app, o);
  }

  /**
   * @param  {any} engine
   */
  mysql(engine) {
    db.mysql.engine = engine;
  }

  /**
   * @param  {any} engine
   */
  mongo(engine) {
    db.mongo.engine = engine;
  }

  /**
   * @param  {any} engine
   */
  pug(engine) {
    $.view.engine = engine;
    // $.view.extension = '.pug';
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
  mongo: new mongo(),
};

/**
 * load .env package.json
 */
export function loadEnvironment() {
  if ($.starter.env) {
    const env = aid.load.env(rootCommon, $.starter.env);
    const _allowed = Object.keys($.environment);
    if (Object.keys(env).length) {
      $.starter.env = "";
    }

    Object.assign(
      $.app,
      Object.keys(env)
        .filter((e) => !_allowed.includes(e))
        .reduce((o, i) => Object.assign({ [i]: env[i] }, o), {})
    );
    Object.assign($.environment, env);
  }

  loadPackage();
}

function loadPackage() {
  const pkg = aid.load.json(rootCommon, $.starter.json);
  if ($.app.name == "") {
    $.app.name = pkg.name;
  }
  if ($.app.description == "") {
    $.app.description = pkg.description;
  }
  if ($.app.version == "") {
    $.app.version = pkg.version;
  }

  // if (!$.app.name) {
  //   const pkg = aid.load.json($.app.dir.root, $.starter.json);
  //   $.app.name = pkg.name;
  //   $.app.description = pkg.description;
  //   $.app.version = pkg.version;
  // }

  // if ($.app.listen && typeof $.app.listen == 'string') {
  //   $.app.listen = aid.parse.context($.app.listen);
  // }
  // if ($.app.restrict && typeof $.app.restrict == "string") {
  //   $.app.restrict = aid.parse.context($.app.restrict);
  // }
  // if ($.app.referer && typeof $.app.referer == 'string'){
  //   $.app.referer = aid.fire.array.unique($.app.referer.split(';')).map(aid.parse.hostNameRegex);
  // }

  // if (typeof pkg.env == "object") {
  //   // $.app.env = pkg.config;
  //   Object.assign($.app.env, pkg.env);
  // }
  if (!$.app.dir.root || $.app.dir.root != rootCommon) {
    $.app.dir.root = rootCommon;
  }

  if ($.environment.mysqlConnection) {
    db.mysql.config = $.environment.mysqlConnection;
    if (db.mysql.engine && db.mysql.pool == null) {
      db.mysql.connect().catch(console.log);
    }
  }

  if ($.environment.mongoConnection) {
    db.mongo.config = $.environment.mongoConnection;
    if (db.mongo.engine && db.mongo.pool == null) {
      db.mongo.connect().catch(console.log);
    }
  }
}

/**
 *
 * @type {InitiateConfiguration}
 */
const init = new InitiateConfiguration();

/**
 * prepare environment
 * set.each set.merge only, every
 */
export const prepareEnvironment = {
  /**
   * set config individually
   * @template T
   * @param {keyof init} name
   * @param {T} val
   * @returns { $ & T | void }
   */
  only(name, val) {
    if (arguments.length == 2) {
      if (name in init) return init[name](val);
    }
  },

  /**
   * set config using Merge
   * @template T
   * @param {T} val - configuration of app
   */
  merge(val) {
    return init.merge(val);
  },
};

export const config = $;

export class Core {
  /**
   * @type{any}
   */
  error;
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
   * for (var name in usage) console.log(`${name} ${Math.round(usage[name] / 1024 / 1024 * 100) / 100} mb`);
   * for (var name in usage) console.log(name, app.byteToMB(usage[name]), "mb");
   */
  memoryUsage() {
    return process.memoryUsage();
  }

  /**
   * @param {number} bytes - Bytes to Megabyte
   * @example
   * Math.round((12000000 / 1024 / 1024) * 100) / 100 to MB
   * Math.round((1200000000 / 1024 / 1024 / 1024) * 100) / 100 to GB
   */
  byteToMB(bytes) {
    return Math.round((bytes / 1024 / 1024) * 100) / 100;
  }

  /**
   * Configuration
   */
  get config() {
    return $.app;
  }

  /**
   * Connect to `MySQL`, `MongoDB`
   */
  get db() {
    return db;
  }

  /**
   * The `callback` is called when `process.on(SIGINT, SIGTERM, EXIT)`.
   * Its signal is sent to a process
   *
   * `SIGINT`, its controlling terminal when a user wishes to interrupt the process.
   * `SIGTERM`, request its termination.
   *
   * This is where it should be closed any external connection like `MySQL`, `MongoDB`,
   * in order not to connect with disabled connection.
   * @param {(error:string|undefined) => void} callback - is executed before exiting process.
   * @param {number} [code] - is [optinal] and modified accordingly exit.
   */
  close(callback, code) {
    process.on("SIGINT", () => {
      callback(this.error);
      this.exit(code);
    });
    process.on("SIGTERM", () => {
      callback(this.error);
      this.exit(code);
    });
    process.on("exit", (e) => {
      callback(this.error);
      code = e;
    });
  }

  /**
   * Exit with code
   * @param {number} code=0
   * @example
   * app.exit(0) -> normal
   * app.exit(1) -> error
   */
  exit(code = 0) {
    process.exit(code);
  }
}
