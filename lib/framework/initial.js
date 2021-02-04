import * as $ from "./config.js";
import aid from "../aid/index.js";
import mysql from '../database/mysql.js';
import mongo from '../database/mongo.js';

var rootCommon = aid.seek.directory(process.argv[1]);

/**
 * init
 */
export class InitialConfiguraiton{
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
    // if (o && o.config instanceof Object) Object.assign($.user, o.config);
    // if (o && o.setting instanceof Object) Object.assign(o.setting,Object.assign($.user,o.setting));
    if (o && o instanceof Object) Object.assign(o,Object.assign($.user,o));
  }

  /**
   * @param  {any} engine
   */
  mysql (engine) {
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
  mongo: new mongo()
};

export function loadConfiguration(){
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

  loadPackage();
}

function loadPackage() {
  $.user.development = !process.env.NODE_ENV || process.env.NODE_ENV.trim() != 'production';
  // process.env.NODE_ENV || 'development';

  if (!$.user.name) {
    const pkg = aid.load.json(rootCommon,$.starter.json);
    $.user.name = pkg.name;
    $.user.description = pkg.description;
    $.user.version = pkg.version;
  }

  // if ($.user.restrict && typeof $.user.restrict == 'string') {
  //   $.user.restrict = aid.parse.context($.user.restrict);
  // }
  // if ($.user.listen && typeof $.user.listen == 'string') {
  //   $.user.listen = aid.parse.context($.user.listen);
  // }
  // if ($.user.referer && typeof $.user.referer == 'string'){
  //   $.user.referer = aid.fire.array.unique($.user.referer.split(';')).map(aid.parse.hostNameRegex);
  // }

  if (!$.user.dir.root || $.user.dir.root != rootCommon){
    $.user.dir.root = rootCommon;
  }

  if($.environment.mysqlConnection) {
    db.mysql.config = $.environment.mysqlConnection;
    if(db.mysql.engine && db.mysql.pool == null) {
      db.mysql.connect().catch(console.log);
    }
  }

  if($.environment.mongoConnection) {
    db.mongo.config = $.environment.mongoConnection;
    if(db.mongo.engine && db.mongo.pool == null) {
      db.mongo.connect().catch(console.log);
    }
  }
}

export default {db, config:$};