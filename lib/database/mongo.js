// @ts-nocheck
/**
 * import * as mariadb from 'mariadb';
 * config:string;
 * factor:any;
 * connection:any;
 * constructor(any)
 */
export default class database {
  config;
  factor = null;
  pool = null;

  constructor() {
    // this.config = e.mongoConnection;
  }

  connect(){
    return new Promise( async (resolve, reject) => {
      if (!this.factor) {
        return reject('no MongoDB found');
      }
      if (!this.config) {
        return reject('no MongoDB Configuration');
      }

      if (this.pool) {
        resolve(this.pool);
      }

      try {
        this.pool = await this.factor.MongoClient.connect(this.config,{ useNewUrlParser: true,useUnifiedTopology: true });
        resolve(this.pool);
      } catch (error) {
        reject(error.message);
      }

    });
  }

  async db(name){
    // await this.connect();
    // return this.pool.db(name)
  }

  // get client(){
  //   if (this.pool){
  //     return this.pool.db();
  //   }
  // }

  close(){
    if (this.pool){
      this.pool.close();
    }
  }
}