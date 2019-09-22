const MongoClient = require('mongodb').MongoClient;

module.exports = class database {
  constructor(e) {
    this.url = e.hasOwnProperty('mongoConnection')?e.mongoConnection:null;
    this.connection = null;
  }

  async connect(url){
    if (!this.connection || url) {
      this.url = url || this.url;
      this.connection = await MongoClient.connect(this.url,{ useNewUrlParser: true,useUnifiedTopology: true });
    }
    return this.connection;
  }

  async db(name){
    await this.connect();
    return this.connection.db(name)
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
