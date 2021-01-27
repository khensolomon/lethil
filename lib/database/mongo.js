// @ts-nocheck
/**
 * import * as mariadb from 'mariadb';
 * config:string;
 * engine:any;
 * connection:any;
 * constructor(any)
 */
export default class database {
  config;
  engine = null;
  pool = null;

  constructor() {}

  connect(){
    return new Promise( async (resolve, reject) => {
      if (!this.engine) {
        return reject('no MongoDB found');
      }
      if (!this.config) {
        return reject('no MongoDB Configuration');
      }

      if (this.pool) {
        resolve(this.pool);
      }

      try {
        this.pool = await this.engine.MongoClient.connect(this.config,{ useNewUrlParser: true,useUnifiedTopology: true });
        resolve(this.pool);
      } catch (error) {
        reject(error.message);
      }

    });
  }

  /**
   * @param {string} name
   */
  query(){
    return new Promise((resolve, reject) => {
      this.connect().then(
        db => resolve(db)
      ).catch(
        error => reject(error)
      );
    });
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