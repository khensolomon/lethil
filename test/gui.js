// import 'mocha';
import * as assert from 'assert';
import http from 'http';
import core from '../lib/index.js';

const config = core.config();
var app;
var requestUrl = 'http://localhost:80';
describe('GUI',  () => {

  before(() => {
    core.root('../evh-test-app');
    // core.port(8086);
  });



  it('server', (done) => {
    core.server().then(
      (e)=> {
        app = e;
        requestUrl = requestUrl.replace('localhost',config.HOST).replace('80',config.PORT);
        done()
        // e.listen(config.PORT, config.HOST, () => {
        //   done();
        // });
      }
    ).catch(
      (error)=> {
        assert.strict.ifError(error);
        done();
      }
    );
  });

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

  it('request', (done) => {
    http.get({
      host : config.HOST,
      port : config.PORT,
      path : '/',
      method : 'GET'
    }, function (res) {
      var data = '';
      res.on('data', function (chunk) {
        data += chunk;
      });
      res.on('end', function () {
        console.log('test.request',res.statusCode,data)
        assert.strict.equal(200, res.statusCode);
        done();
      });
    });
  });

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
