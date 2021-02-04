import * as util from 'util';

/**
 * import * as mysql from 'mysql';
 * config  = null;
 * config  = { connectionLimit: 100, host: process.env.SQL_HOST, user: process.env.SQL_USER, password: process.env.SQL_PASSWORD, database: process.env.SQL_DATABASE, debug:false, waitForConnections: true, multipleStatements: true };
 * engine  = null;
 * pool    = null;
 * result  = null;
 */
export default class database {

  constructor() {
    this.config = '';
    /**
     * @type {any}
     */
    this.engine = {};
    /**
     * @type {any}
     */
    this.pool = '';
    this.result = '';
  }

  connect(){
    return new Promise((resolve, reject) => {
      if (!this.engine || typeof this.engine == 'object' && !this.engine.hasOwnProperty('createPool')) {
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
      /**
       * @type {{():Promise<any>}}
       */
      var connector = util.promisify(this.pool.getConnection).bind(this.pool);
      connector().then(
        connection => resolve(connection)
      ).catch(
        error => {
          // 'POOL_CLOSED','ER_ACCESS_DENIED_ERROR'
          if(['ECONNRESET', 'ECONNREFUSED','PROTOCOL_CONNECTION_LOST'].indexOf(error.code) < 0) {
            return reject(error.message||error);
          }
          setTimeout(() => {
            this.connect().then(
              e => resolve(e)
            ).catch(
              e => reject(e.message||e)
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
          /**
           * @type {{(sql:any, arg:any):Promise<any>}}
           */
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