// const mysql = require('mysql');
// const mariadb = require('mariadb');
const util = require('util');
module.exports = class database {
  constructor(e) {
    this.url = e.hasOwnProperty('mysqlConnection')?e.mysqlConnection:null;
    this.result = null;
    this.connection = null;
    this.query = this.noConnection;
    this.factor = null;
  }

  async noConnection() {
    throw new Error('No Connection available')
  }
  async join(sql, arg) {
    this.result = await this.query(sql, arg);
    return this;
  }

  async handlePool(){
    if (!this.factor) {
      throw {code:'mysql',message:'No module found'};
    }
    // const pool = mysql.createPool(this.url);
    const pool = this.factor.createPool(this.url);
    const connector = util.promisify(pool.getConnection).bind(pool);
    await connector().then(
      db => {
        this.connection = db;
        this.query = util.promisify(db.query).bind(db);
        // this.queryTesting = function(q,a){
        //   return new Promise(function(res,rej){
        //     db.query(q,a,function(err, result, fields){
        //       err?rej(err):res(result, fields);
        //     })
        //   });
        // }


        // const promiseConnection = util.promisify(db.connect).bind(db);
        // promiseConnection().catch(
        //   e=> {
        //     if(e.code != 'ER_BAD_DB_ERROR') {
        //       setTimeout(()=>{
        //         db.destroy();
        //         this.handlePool().then(
        //           ()=>console.log('Reconnected')
        //         ).catch(
        //           e=>{}
        //         );
        //       }, 1000);
        //     }
        //     throw {code:e.code,message:e.message.replace(e.code+':','').trim()};
        //   }
        // );

        db.on('error', e =>{
          if(e.code === 'PROTOCOL_CONNECTION_LOST') {
            this.handlePool().catch(
              e=>console.info(e.code,e.message)
            );
          }
        });
      }
    ).catch(
      e=> {
        if(e.code != 'ER_BAD_DB_ERROR') {
          setTimeout(()=>{
            // db.destroy();
            this.connection.release();
            this.handlePool().catch(
              e=>{}
            );
          }, 1000);
        }
        throw {code:e.code,message:e.message.replace(e.code+':','').trim()};
      }
    )
  }

  async handleDisconnect(){
    if (!this.factor) {
      throw {code:'mysql',message:'No module found'};
    }
    // this.connection = mysql.createConnection(this.url);
    this.connection = this.factor.createConnection(this.url);
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
    this.connection.release()
    // this.connection.end()
  }
}