```js

import 'mocha';
import * as assert from 'assert';
import http from 'http';
import core from '../lib/index.js';
// import {server, config, default as set} from '../lib/index.js';

const $ = core.config();

describe('GUI',  () => {
  core.root('/server/evh-test-app');
  // core.port('8087');
  var app;
  var requestUrl = 'http://localhost:8086';

  // before(async () => {
  //   set.root('/server/evh-test-app');
  //   set.port('8087');
  // });

  // it('init', async (done) => {
  //   try {
  //     app = await core.server();
  //     // console.log('??',$.user);
  //     // console.log('??',$.user.HOST,$.user.PORT);
  //   } catch (error) {
  //     assert.strict.ifError(error);
  //   }
  // });
  it('init', async (done) => {
    // try {
    //   app = await core.server();
    //   // console.log('??',$.user);
    //   // console.log('??',$.user.HOST,$.user.PORT);
    // } catch (error) {
    //   assert.strict.ifError(error);
    // }
    app = await core.server();
    app.listen($.user.PORT, $.user.HOST, error => {
      // assert.strict.ifError(error);
      done();
    });
  });

  // it('listen', done  => {
  //   app.listen($.user.PORT, $.user.HOST, error => {
  //     assert.strict.ifError(error);
  //     done();
  //   });
  // });
  // it(`listen ${process.env.HOST}:${process.env.PORT}`, done  => {
  //   app.listen(process.env.PORT, process.env.HOST, error => {
  //     assert.strict.ifError(error);
  //     done();
  //   });
  // });

  // it('error', done  => {
  //   app.on('error', error => {
  //     assert.strict.ifError(error);
  //     done();
  //   });
  // });

  // it('listening', (done) => {
  //   app.on('listening', () => {
  //     done();
  //   });
  // });

  // it('close', done  => {
  //   app.on('close', () => {
  //     done();
  //   });
  // });

  // it('connection', done  => {
  //   app.on('connection', () => {
  //     done();
  //   });
  // });

  it('should return 200', function (done) {
    http.get(requestUrl, function (res) {
      assert.strict.equal(200, res.statusCode);
      done();
    });
  });

  // it('request and expected "Not found"', function (done) {
  //   http.get(requestUrl, function (res) {
  //     var data = '';

  //     res.on('data', function (chunk) {
  //       data += chunk;
  //     });

  //     res.on('end', function () {
  //       assert.strict.equal('Not found', data);
  //       done();
  //     });
  //   });
  // });

  it('closing', function (done) {
    app.close( error => {
      assert.strict.ifError(error);
      done();
    });
  });

  // after(() => {
  //   // console.log('3')
  //   // console.log(app)
  //   app.close();
  // });

});

/*
describe('GUI',  () => {
  set.root('/server/evh-test-app');
  // set.hostname('test.local');
  // set.port('8087');
  var app;
	it('init', async ()  => {
    try {
      app = await server();
      assert.strict.ifError(null);
    } catch (error) {
      // assert.fail(error);
      assert.strict.ifError(error);
    }

    // describe('listening',  () => {
    //   it(`event`, async ()  => {
    //     app.server.on('error', (e:any) =>{
    //       app.server.close();
    //       assert.strict.ifError(e);
    //     });
    //     app.server.on('listening', (e:any) =>{
    //       // app.server.close();
    //       console.log('listening',process.env.PORT,process.env.HOST)
    //     });
    //     app.server.on('close', () =>{
    //       console.log('close')
    //     });
    //   });
    // });

    // describe('listening direct from Node api',  () => {
    //   app.listen(process.env.PORT, process.env.HOST);
    //   it(`host: ${process.env.HOST}, port:${process.env.PORT}`,  () => {
    //     app.server.on('listening', () =>{
    //       assert.strict.ifError(null);
    //     });
    //     app.server.on('error', (e:any) =>{
    //       app.server.close();
    //       assert.strict.ifError(e);
    //     });
    //   });
    // });

    describe('events',  () => {

      it(`listen to host:${process.env.HOST} & port:${process.env.PORT}`,  () => {
        app.listen(process.env.PORT, process.env.HOST,()=>{
          console.log('listening');
        });

        app.on('error', e =>{
          app.close();
          // assert.fail(e);
          assert.strict.ifError(e);
        });

        app.on('close', () => {
          console.log('on close');
        });
        app.on('connection', () => {
          console.log('on connection');
        });
        // process.env.PORT = ' 8086';
        // process.env.HOST = ' localhost';

      });

      it('close',  () => {
        app.on('listening', () => {
          app.close();
          console.log('on listening');
        });
      });

    });

  });

});
*/
// const app:any = server();
// app.set('port',4000);
// app.set('hostname','localhost');
// app.listen(process.env.PORT, process.env.HOST);