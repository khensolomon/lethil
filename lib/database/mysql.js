// @ts-nocheck

import { log } from 'console';
import * as util from 'util';
// import * as mysql from 'mysql';

/**
 * config:any  = null;
 * engine:any  = null;
 * pool:any    = null;
 * result:any  = null;
 * constructor(any)
 */
/*
const config = {
  connectionLimit: 100,
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DATABASE,
  debug:false,
  waitForConnections: true,
  multipleStatements: true
};
*/
export default class database {
  config  = null;
  engine  = null;
  pool    = null;
  result  = null;

  constructor() {}

  connect(){
    return new Promise((resolve, reject) => {
      if (!this.engine) {
        return reject('no MySQL found');
      }
      if (!this.config) {
        return reject('no MySQL Configuration');
      }
      if (this.config === undefined) {
        return reject('Pool is closed');
      }

      if (!this.pool) {
        this.pool = this.engine.createPool(this.config);
      }
      const connector = util.promisify(this.pool.getConnection).bind(this.pool);
      connector().then(
        connection => resolve(connection)
      ).catch(
        error => {
          // 'POOL_CLOSED','ER_ACCESS_DENIED_ERROR'
          if(['ECONNRESET', 'ECONNREFUSED','PROTOCOL_CONNECTION_LOST'].indexOf(error.code) < 0) {
            // console.log('?','just reject it',error.code);
            return reject(error.message||error);
          }
          setTimeout(() => {
            // console.log('2','reconnecting error',error.code);
            this.connect().then(
              e => {
                // console.log('3','done');
                resolve(e);
              }
            ).catch(
              e => {
                // console.log('3',e)
                //
                reject(e.message||e);
              }
            );
          }, 2000);
        }
      );

    });

  }

  /**
   * @param {any} sql
   * @param {any} arg
   */
  query(sql, arg){
    return new Promise((resolve, reject) => {
      this.connect().then(
        connection => {
          var db = util.promisify(connection.query).bind(connection);
          db(sql, arg).then(
            raw => resolve(raw)
          ).catch(
            error => reject(error)
          ).finally(
            () => connection.release()
          );
        }
      ).catch(
        error => reject(error)
      );
    });
  }

  close(){
    this.connect().then(
      ()=>this.pool.end()
    ).catch(
      ()=>{}
    );
  }
}