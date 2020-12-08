// const MongoClient = require('mongodb').MongoClient;

module.exports = class database {
  constructor(e) {
    this.config = e.hasOwnProperty('mongoConnection')?e.mongoConnection:null;
    this.connection = null;
    this.factor = null;
  }

  async connect(config){
    if (!this.connection || config) {
      this.config = config || this.config;
      // this.connection = await MongoClient.connect(this.url,{ useNewUrlParser: true,useUnifiedTopology: true });
      this.connection = await this.factor.MongoClient.connect(this.config,{ useNewUrlParser: true,useUnifiedTopology: true });
    }
    return this.connection;
  }

  async db(name){
    // await this.connect();
    // return this.connection.db(name)
  }

  // get client(){
  //   if (this.connection){
  //     return this.connection.db();
  //   }
  // }

  close(){
    if (this.connection){
      return this.connection.close();
    }
  }
}
