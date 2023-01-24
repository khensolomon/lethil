import * as $ from "./config.js";
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
 * init PrepareEnvironment
 */
export class PrepareEnvironment {
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
   * @param  {any} o
   * @returns {$.app & o}
   */
  config(o) {
    // if (o && o.config instanceof Object) Object.assign($.app, o.config);
    // if (o && o.setting instanceof Object) Object.assign(o.setting,Object.assign($.app,o.setting));

    if (aid.check.isObject(o)) {
      return aid.fire.object.merge($.app, o);
      // Object.assign(o, Object.assign($.app, o));
    }
    return $.app;
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

export default { db, config: $ };
