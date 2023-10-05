import * as $ from "./env.js";
import aid from "../aid/index.js";
import * as mysql from "../database/mysql.js";
import * as mongo from "../database/mongo.js";
import * as flat from "../database/flat.js";

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
 * @typedef {object} configurate - Get configuration, update individually or merge
 * @property {(...directory: any)=> void} root - Set the root directory
 * ```js
 * .root("a","b");
 * .root("../a");
 * ```
 * @property {(portnumber: number)=> void} port - Set port number
 * ```js
 * .port(80);
 * ```
 * @property {(name: string)=> void} hostname - Set hostname
 * ```js
 * .hostname("127.0.0.1");
 * .hostname("localhost");
 * ```
 * @property {(engine: mysql)=> void} mysql - Set MySQL engine. If `string` is provided the package must be installed
 * ```js
 * ...mysql("mysql2");
 *
 * import mysql from "mysql2";
 * ...mysql(mysql);
 * ```
 * @property {(engine: mongo)=> void} mongo - Set MongoDB engine. If `string` is provided the package must be installed
 * ```js
 * ...mongo("mongodb");
 *
 * import mongo from 'mongodb';
 * ...mongo(mongo);
 * ```
 * @property {<T>(o: T)=>$.config & o} merge - set config using Merge
 * ```js
 * .merge({});
 * ```
 */
/**
 * @type {configurate}
 */
const configurate = {
  /**
   * @param  {any} directory - Set the root directory
   * @example
   * root("a","b")
   * root("../a")
   */
  root(...directory) {
    rootCommon = aid.seek.directory(directory);
  },

  /**
   * @param  {number} portnumber - Set port number
   */
  port(portnumber) {
    $.config.listen.port = portnumber;
  },

  /**
   * @param  {string} name - Set hostname
   */
  hostname(name) {
    $.config.listen.host = name;
  },

  /**
   * param  {any} engine - Set MySQL engine
   * @param  {module} engine - Set MySQL engine
   * param  {import("mysql2")} engine - Set MySQL engine
   */
  async mysql(engine) {
    if (typeof engine == "string") {
      var pathToModule = aid.seek.resolve(rootCommon, "node_modules", engine);
      db.mysql.engine = await import(pathToModule);
    } else {
      db.mysql.engine = engine;
    }
  },

  /**
   * @param  {any} engine - Set MongoDB engine
   */
  async mongo(engine) {
    if (typeof engine == "string") {
      var pathToModule = aid.seek.resolve(rootCommon, "node_modules", engine);
      db.mongo.engine = await import(pathToModule);
    } else {
      db.mongo.engine = engine;
    }
  },
  // /**
  //  * set config individually
  //  * @template T
  //  * @param {keyof configuration} name
  //  * @param {T} val
  //  * @returns { $ & T | void }
  //  */
  // set(name, val) {
  //   if (name in configuration) {
  //     if (arguments.length == 2) {
  //       return configuration[name](val);
  //     }
  //   }
  // },

  // /**
  //  * set config using Merge
  //  * @template T
  //  * @param {T} val - configuration of app
  //  * @returns { $.config & T }
  //  */
  // put(val) {
  //   return configuration.put(val);
  // },

  /**
   * @template T - set config using Merge
   * @param  { T } o - configuration of app
   * @returns { $.config & T }
   */
  merge(o) {
    return aid.fire.object.merge($.config, o);
  },
};

export const config = Object.assign($.config, configurate);

// /**
//  * @typedef {Object} db
//  * @property {mysql.default} mysql
//  * @property {mongo.default} mongo
//  * @property {typeof flat.default} flat
//  */

export const db = {
  // /**
  //  * @type {mysql.default} mysql
  //  */
  mysql: new mysql.default(),
  // /**
  //  * @type {mongo.default} mongo
  //  */
  mongo: new mongo.default(),
  // /**
  //  * Read flat file csv, tsv
  //  */
  flat: flat.default,
};

/**
 * read package
 */
function loadPackage() {
  const pkg = aid.load.json(rootCommon, $.starter.json);
  if ($.config.name == "") {
    $.config.name = pkg.name;
  }
  if ($.config.description == "") {
    $.config.description = pkg.description;
  }
  if ($.config.version == "") {
    $.config.version = pkg.version;
  }

  // if (!$.config.name) {
  //   const pkg = aid.load.json($.config.dir.root, $.starter.json);
  //   $.config.name = pkg.name;
  //   $.config.description = pkg.description;
  //   $.config.version = pkg.version;
  // }

  // if ($.config.listen && typeof $.config.listen == 'string') {
  //   $.config.listen = aid.parse.context($.config.listen);
  // }
  // if ($.config.restrict && typeof $.config.restrict == "string") {
  //   $.config.restrict = aid.parse.context($.config.restrict);
  // }
  // if ($.config.referer && typeof $.config.referer == 'string'){
  //   $.config.referer = aid.fire.array.unique($.config.referer.split(';')).map(aid.parse.hostNameRegex);
  // }

  // if (typeof pkg.env == "object") {
  //   // $.config.env = pkg.config;
  //   Object.assign($.config.env, pkg.env);
  // }
  if (!$.config.dir.root || $.config.dir.root != rootCommon) {
    $.config.dir.root = rootCommon;
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
 * Prepare configuration load .env package.json
 * It should require before the core have been initiated
 */
export function loadEnvironment() {
  if ($.starter.env) {
    const env = aid.load.env(rootCommon, $.starter.env);
    const _allowed = Object.keys($.environment);
    if (Object.keys(env).length) {
      $.starter.env = "";
    }

    Object.assign(
      $.config,
      Object.keys(env)
        .filter((e) => !_allowed.includes(e))
        .reduce((o, i) => Object.assign({ [i]: env[i] }, o), {})
    );

    Object.assign($.environment, env);
  }

  loadPackage();
}

// /**
//  * prepare environment
//  * set.each set.merge only, every
//  * @example
//  * configuration.set("port", 1981)
//  * configuration.change("port", 1981)
//  * configuration.alter("port", 1981)
//  * configuration.update("port", 1981)
//  * configuration.merge({})
//  * configuration.set("port", 1981)
//  * configuration.put({})
//  */
// export const prepareEnvironment = {
//   /**
//    * set config individually
//    * @template T
//    * @param {keyof configuration} name
//    * @param {T} val
//    * @returns { $ & T | void }
//    */
//   set(name, val) {
//     if (name in configuration) {
//       if (arguments.length == 2) {
//         return configuration[name](val);
//       }
//     }
//   },

//   /**
//    * set config using Merge
//    * @template T
//    * @param {T} val - configuration of app
//    * @returns { $.config & T }
//    */
//   put(val) {
//     return configuration.put(val);
//   },
// };

// export const config = $;

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
    return $.config;
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
