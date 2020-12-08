// const mysql = require('mysql');
// const mariadb = require('mariadb');
const util = require('util');
module.exports = class database {
  constructor(e) {
    this.config = e.hasOwnProperty('mysqlConnection')?e.mysqlConnection:null;
    this.factor = null;
    this.pool = null;
    this.result = null;
    // this.connection = null;
    // this.query = this.noConnection;

    // const config = {
    //   connectionLimit: 100,
    //   host: process.env.SQL_HOST,
    //   user: process.env.SQL_USER,
    //   password: process.env.SQL_PASSWORD,
    //   database: process.env.SQL_DATABASE,
    //   debug:false,
    //   waitForConnections: true,
    //   multipleStatements: true
    // };
  }

  async handlePool(){
    return new Promise((resolve, reject) => {
      if (!this.factor) {
        return reject('No MySQL module found');
      }
      if (!this.config) {
        return reject('No MySQL configuration');
      }
      if (!this.pool) {
        this.pool = this.factor.createPool(this.config);
      }
      const connector = util.promisify(this.pool.getConnection).bind(this.pool);
      connector().then(
        connection => resolve(connection)
      ).catch(
        error => {
          if(['ECONNRESET', 'ECONNREFUSED','PROTOCOL_CONNECTION_LOST'].indexOf(error.code) < 0) {
            // console.log('?','just reject it',error.code);
            return reject(error);
          }
          setTimeout(() => {
            // console.log('2','reconnecting error',error.code);
            this.handlePool().then(
              e => {
                // console.log('3','done');
                resolve(e);
              }
            ).catch(
              e => {
                // console.log('3',e)
                reject(e);
              }
            );
          }, 2000);
        }
      );
    });
  }

  query(sql, arg){
    return new Promise((resolve, reject) => {
      this.handlePool().then(
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
}