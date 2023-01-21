import "mocha";
import * as assert from "assert";
// import http from "http";
import { server, set, config, route } from "../lethil.mjs";
// import core from "../lib/lethil.js";

const app = server();

// var requestUrl = "http://localhost:80";
describe("app.server", () => {
  before(() => {
    // core.server();
    // core.set('root','../evh-test-app');
    // core.set("port", 8087);
  });
  it("add default route", () => {
    new route.gui("navPage", "/").get("/", function (req, res) {
      // return "yes";
      assert.ok(true);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.write("Hello World!");
      res.end();
    });
  });
  // requestUrl = requestUrl.replace('localhost',config.HOST).replace('80',config.PORT);
  // core.server();

  it("default port is 80", () => {
    assert.strictEqual(80, config.listen.port);
  });

  it("update port to 8099", () => {
    set("port", 8099);
    assert.strictEqual(8099, config.listen.port);
  });

  it("reset port", () => {
    set("port", 80);
    assert.strictEqual(80, config.listen.port);
  });

  it("default hostname is 127.0.0.1", () => {
    assert.strictEqual("127.0.0.1", config.listen.host);
  });

  it("update host to 0.0.0.0", () => {
    set("hostname", "0.0.0.0");
    assert.strictEqual("0.0.0.0", config.listen.host);
  });

  it("reset host", () => {
    set("hostname", "127.0.0.1");
    assert.strictEqual("127.0.0.1", config.listen.host);
  });

  // it("config.PORT is 2023", () => {
  //   assert.strictEqual(2023, config.PORT);
  // });

  it("listen ", (done) => {
    // app.listen(config.PORT, config.HOST, (error) => {
    //   console.log(config.PORT, config.HOST);
    //   assert.strict.ifError(error);
    //   done();
    // });
    app.listen(config.listen, (error) => {
      // if (typeof app.address == "object") {
      //   console.log("1", config.name, app.address.address, app.address.port);
      // } else {
      //   console.log("2", config.name, app.address);
      // }

      // assert.strictEqual("", config.name);
      // assert.strictEqual("127.0.0.1", app.address.address);
      // assert.strictEqual(80, app.address.port);
      assert.strict.ifError(error);
      // app.close();
      // done();
    });
  });

  // it("now listening 127.0.0.1:80", () => {
  //   assert.strictEqual("127.0.0.1", app.address.address);
  //   assert.strictEqual(80, app.address.port);
  // });

  // it("404", () => {
  //   http
  //     .get(
  //       {
  //         host: "127.0.0.1",
  //         port: app.address.port,
  //         path: "/",
  //         method: "GET",
  //       },
  //       function (res) {
  //         console.log("test.404", res);
  //         // assert.strict.equal(404, res.statusCode);
  //         assert.ok(true);
  //         // done();
  //       }
  //     )
  //     .on("error", (e) => {
  //       console.error(`Got error: ${e.message}`);
  //       // assert.ok(true);
  //       assert.ifError(e);
  //       // done();
  //     });
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

  after((done) => {
    app.close();
    // console.log('close')
    // process.exit()
    done();
  });
});
