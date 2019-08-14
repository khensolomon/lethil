const mysql = require('mysql');
module.exports = class database {
  constructor(args) {
    this.connection = mysql.createConnection(args);
    this.result = null;
  }
  query(sql, args) {
    return new Promise((resolve,reject) =>{
      this.result = this.connection.query(sql, args, (e, row) => e?reject(e):resolve(row));
    });
  }
  connect(args){
    return mysql.createConnection(args);
  }
  format(sql, args){
    return this.connection.format(sql, args);
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