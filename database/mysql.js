const mysql = require('mysql');
module.exports = class database {
  constructor(e) {
    this.url = e.hasOwnProperty('mysqlConnection')?e.mysqlConnection:null;
    this.result = null;
    this.connection = null;
  }

  query(sql, args) {
    return new Promise((resolve,reject) =>{
      this.connection.query(sql, args, (e, row) => e?reject(e):resolve(row));
    });
  }

  async join(sql, args) {
    this.result = await this.query(sql, args);
    return this;
  }
  connect(){
    return new Promise((resolve,reject) =>{
      if (!this.connection && this.url) {
        this.connection = mysql.createConnection(this.url);
      }
      this.connection.connect(e=>{
        if (e){
          return reject({code:e.code,message:e.message.replace(e.code+':','').trim()});
        } else {
          return resolve()
        }
      });
      this.connection.on('error', e => {
        console.log('sql','lost connection');
        if(e.code === 'PROTOCOL_CONNECTION_LOST') {
          console.log('reconnecting');
          return this.connect().then(()=>resolve('done')).catch((e)=>reject(e.message));
        } else {
          return reject(e);
        }
      });
    });
  }
  handleDisconnect(){
    // http://sudoall.com/node-js-handling-mysql-disconnects/
    this.connection = mysql.createConnection(this.url);
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





    // this.connection.connect( (e) =>{
    //   if(e) {
    //     // console.log('sql','error when connecting to db: reconnect in',2000);
    //     // setTimeout(()=>{
    //     //   this.handleDisconnect().then(resolve).catch(reject);
    //     // }, 200);
    //     // throw {code:e.code,message:e.message.replace(e.code+':','').trim()};
    //     throw 'error??'
    //     // console.log(e)
    //     // return Promise.reject({code:e.code,message:e.message.replace(e.code+':','').trim()})
    //   }
    // });
    // this.connection.on('error', (e) =>{
    //   if(e.code === 'PROTOCOL_CONNECTION_LOST') {
    //     console.log('sql','lost connection','reconnecting');
    //     // this.connection.destroy();
    //     // await this.handleDisconnect().then(resolve).catch(reject).finally(()=>console.log('check sql connection manually???'));
    //     // this.handleDisconnect().then(resolve).catch(reject);
    //     console.log('check sql connection manually???')
    //   } else {
    //     throw e;
    //   }
    // });
  }
  /*
  handleDisconnect(){
    // http://sudoall.com/node-js-handling-mysql-disconnects/
    this.connection = mysql.createConnection(this.url);
    return new Promise((resolve,reject) =>{
      this.connection.connect( (e) =>{
        if(e) {
          // console.log('sql','error when connecting to db: reconnect in',2000);
          // setTimeout(()=>{
          //   this.handleDisconnect().then(resolve).catch(reject);
          // }, 200);
          reject({code:e.code,message:e.message.replace(e.code+':','').trim()});
        } else {
          resolve()
        }
      });
      this.connection.on('error', (e) =>{
        if(e.code === 'PROTOCOL_CONNECTION_LOST') {
          console.log('sql','lost connection','reconnecting');
          // this.connection.destroy();
          // await this.handleDisconnect().then(resolve).catch(reject).finally(()=>console.log('check sql connection manually???'));
          this.handleDisconnect().then(resolve).catch(reject);
          console.log('check sql connection manually???')
        } else {
          throw e;
        }
      });
    });
  }
  */
  /*
  handleDisconnect(){
    // http://sudoall.com/node-js-handling-mysql-disconnects/
    this.connection = mysql.createConnection(this.url);
    return new Promise((resolve,reject) =>{
      this.connection.connect( (e) =>{
        if(e) {
          // console.log('sql','error when connecting to db: reconnect in',2000);
          // setTimeout(()=>{
          //   this.handleDisconnect().then(resolve).catch(reject);
          // }, 200);
          reject({code:e.code,message:e.message.replace(e.code+':','').trim()});
        } else {
          resolve()
        }
      });
      this.connection.on('error', (err) =>{
        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.log('sql','lost connection','reconnecting');
          this.handleDisconnect().then(resolve).catch(reject).finally(()=>console.log('check sql connection manually???'));
        } else {
          throw err;
        }
      });
    });
  }
  */
  format(sql, args){
    // this.queryFormat();
    return this.connection.format(sql, args);
  }
  queryFormat(){
    this.connection.config.queryFormat = function (query, values) {
      if (!values) return query;
      return query.replace(/\:(\w+)/g, function (txt, key) {
        if (values.hasOwnProperty(key)) {
          return this.escape(values[key]);
        }
        return txt;
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

// export default class database {
//   public connection:any;
//   public result:any;
//   constructor(args?:{}) {
//     this.connection = mysql.createConnection(args);
//   }
//   query(sql?:string, args?:any) {
//     return new Promise((resolve,reject) =>{
//       this.result = this.connection.query(sql, args, (e?:null, row?:any) => e?reject(e):resolve(row));
//     });
//   }
//   connect(args?:{}){
//     return mysql.createConnection(args);
//   }
//   format(sql?:string, args?:any){
//     return this.connection.format(sql, args);
//   }
//   escape(args?:any){
//     return this.connection.escape(args);
//   }
//   close(){
//     return new Promise((resolve, reject) => {
//       this.connection.end((e?:null) => e?reject(e):resolve());
//     });
//   }
// }
/*
module.exports = class Database {

  constructor(args={}) {
    this.connection = mysql.createConnection(args);
    // this.connection = this.connect(args);
  }
  query(sql, args) {
    return new Promise((resolve,reject) =>{
      this.connection.query(sql, args, (error, row) => {
        if (error) return reject(error);
        resolve(row);
      });
    });
  }
  connect(args){
    return mysql.createConnection(args);
  }
  format(sql, args){
    return this.connection.format(sql, args);
  }
  close(){
    return new Promise((resolve, reject) => {
      this.connection.end(error => {
        if (error) return reject(error);
        resolve();
      });
    });
  }
}
*/
// let connection = mysql.createConnection(process.env.mysqlConnection);
// connection = mysql.createConnection({
//   host     : 'localhost',
//   user     : enviroment.MYSQL_USER,
//   password : 'search',
//   database : 'zaideih_beta'
// });

// connection.connect();
// connection.connect(function(err) {
//   if (err) {
//     console.error('error connecting: ' + err.stack);
//     return;
//   }
//   console.log('connected as id ' + connection.threadId);
// });

// connection.end();
// if (process.env.mysqlConnection) {
// }


// let connection  = mysql.createPool(process.env.mysqlConnection);

// connection.getConnection(function(err, connection) {
//   if (err) throw err; // not connected!
// });

// connection.getConnection((err, connection) => {
//     if (err) {
//         if (err.code === 'PROTOCOL_CONNECTION_LOST') {
//             console.error('Database connection was closed.')
//         }
//         if (err.code === 'ER_CON_COUNT_ERROR') {
//             console.error('Database has too many connections.')
//         }
//         if (err.code === 'ECONNREFUSED') {
//             console.error('Database connection was refused.')
//         }
//     }
//     if (connection) connection.release()
//     return
// })

// module.exports = connection;