/**
 * import mongodb from 'mongodb';
 * config:string;
 * engine:any;
 * constructor(any)
 */
export default class database {
  constructor() {
    this.config = '';
    /**
     * @type {*}
     */
    this.engine = {};
    this.pool = null;
  }

  connect(){
    return new Promise( async (resolve, reject) => {
      if (!this.engine || typeof this.engine == 'object' && !this.engine.hasOwnProperty('MongoClient')) {
        return reject('no MongoDB found');
      }
      if (!this.config) {
        return reject('no MongoDB Configuration');
      }

      if (this.pool) {
        return resolve(this.pool);
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
   * param {string} name
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