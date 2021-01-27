// import 'mocha';
import * as assert from 'assert';
import http from 'http';
import core from '../lib/index.js';

const app = core.server();
const config = core.config;

var requestUrl = 'http://localhost:80';
describe('GUI',  () => {

  before(() => {
    // core.server();
    // core.set('root','../evh-test-app');
    // core.set('port',8086);
  });

    // requestUrl = requestUrl.replace('localhost',config.HOST).replace('80',config.PORT);
    // core.server();

  it('listen ', (done) => {
    app.listen(config.PORT, config.HOST, (error) => {
      assert.strict.ifError(error);
      done();
    });
  });


  // it('404', (done) => {
  //   http.get({
  //     host : config.HOST,
  //     port : config.PORT,
  //   }, function (res) {
  //     console.log('test.404',res.statusCode)
  //     // assert.strict.equal(404, res.statusCode);
  //     done();
  //   });
  // });

  // it('request', (done) => {
  //   http.get({
  //     host : config.HOST,
  //     port : config.PORT,
  //     path : '/',
  //     method : 'GET'
  //   }, function (res) {
  //     var data = '';
  //     res.on('data', function (chunk) {
  //       data += chunk;
  //     });
  //     res.on('end', function () {
  //       console.log('test.request',res.statusCode,data)
  //       assert.strict.equal(200, res.statusCode);
  //       done();
  //     });
  //   });
  // });

  // it('get->API first', function (done) {
  //   http.get({
  //     host : config.HOST,
  //     port : config.PORT,
  //     path : '/api',
  //     method : 'GET'
  //   }, (res) => {
  //     var data = '';

  //     res.on('data', function (chunk) {
  //       data += chunk;
  //     });

  //     res.on('end', function () {
  //       assert.strict.equal('get->API first', data);
  //       done();
  //     });
  //   });
  // });

  after(() => {
    app.close();
    // console.log('close')
    // process.exit()
  });

});
