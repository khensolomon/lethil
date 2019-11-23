const mysql = require('mysql');
const util = require('util');
module.exports = class database {
  constructor(e) {
    this.url = e.hasOwnProperty('mysqlConnection')?e.mysqlConnection:null;
    this.result = null;
    this.connection = null;
  }

  // query(sql, arg) {
  //   return new Promise((resolve,reject) => this.connection.query(sql, arg, (e, row) => e?reject(e):resolve(row)));
  // }
  async join(sql, arg) {
    this.result = await this.query(sql, arg);
    return this;
  }
  // NOTE: multi rows expected
  // raw(sql, arg) {
  //   // const query = util.promisify(this.connection.query).bind(this.connection);
  //   // return await query(sql, arg);
  //   try {
  //     return this.query(sql, arg);
  //   } catch (e) {
  //     throw e;
  //   }
  // }
  // NOTE: single row expected
  // row(sql, arg) {
  //   try {
  //     return this.query(sql, arg).then(([r]) => r);
  //   } catch (e) {
  //     throw e;
  //   }
  // }
  async connect(){
    this.connection = mysql.createConnection(this.url);
  }
  handleDisconnect(){
    // http://sudoall.com/node-js-handling-mysql-disconnects/
    this.connection = mysql.createConnection(this.url);
    this.query = util.promisify(this.connection.query).bind(this.connection);
    return new Promise((resolve,reject) =>{
      this.connection.connect(e=>{
        if(e) {
          if(e.code != 'ER_BAD_DB_ERROR') {
            setTimeout(()=>{
              this.connection.destroy();
              this.handleDisconnect().then(resolve).catch(reject);
            }, 1000);
          }
          reject({code:e.code,message:e.message.replace(e.code+':','').trim()})
        } else {
          resolve();
        }
      });
      this.connection.on('error', e =>{
        if(e.code === 'PROTOCOL_CONNECTION_LOST') {
          this.handleDisconnect().then(resolve).catch(reject);
        }
      });
    });
  }
  format(sql, args){
    // this.queryFormat();
    return this.connection.format(sql, args);
  }
  queryFormat(){
    this.connection.config.queryFormat = function (query, values) {
      if (!values) return query;
      return query.replace(/\:(\w+)/g, function (v, key) {
        if (values.hasOwnProperty(key)) {
          return this.escape(values[key]);
        }
        return v;
      }.bind(this));
    };
  }
  escape(args){
    return this.connection.escape(args);
  }
  close(){
    return new Promise((resolve, reject) => {
      this.connection.end((e) => e?reject(e):resolve());
    });
  }
}