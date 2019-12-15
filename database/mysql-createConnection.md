# mysql

```js
const mysql = require('mysql');
// const mariadb = require('mariadb');
const util = require('util');
module.exports = class database {
  constructor(e) {
    this.url = e.hasOwnProperty('mysqlConnection')?e.mysqlConnection:null;
    this.result = null;
    this.connection = null;
  }

  async join(sql, arg) {
    this.result = await this.query(sql, arg);
    return this;
  }

  // NOTE: multi rows expected
  // raw(sql, arg) {
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

  // async handleDisconnectTesting(){
  //   const pool = mariadb.createPool(this.url);
  //   await pool.getConnection().then(conn => {
  //     conn.query('SELECT * FROM visits').then(
  //       e=>console.log(e)
  //     )
  //   });
  // }
  async handleDisconnect(){

    this.connection = mysql.createConnection(this.url);
    this.query = util.promisify(this.connection.query).bind(this.connection);
    const promiseConnection = util.promisify(this.connection.connect).bind(this.connection);
    await promiseConnection().catch(
      e=> {
        if(e.code != 'ER_BAD_DB_ERROR') {
          setTimeout(()=>{
            this.connection.destroy();
            this.handleDisconnect().then(
              ()=>console.log('Reconnected')
            ).catch(
              e=>{}
            );
          }, 1000);
        }
        throw {code:e.code,message:e.message.replace(e.code+':','').trim()};
      }
    );
    this.connection.on('error', e =>{
      if(e.code === 'PROTOCOL_CONNECTION_LOST') {
        this.handleDisconnect().catch(
          e=>console.log(e.code,e.message)
        );
      }
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
    this.connection.end()
  }
}