const mysqlConnection = require("./mysql");
const mongoConnection = require("./mongo");

module.exports = {
  mongo:mongoConnection,
  mysql:mysqlConnection,
  testing:'Ok'
};