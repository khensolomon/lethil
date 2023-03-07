import "mocha";
import * as assert from "assert";
import http from "http";
import { server, set } from "../lethil.mjs";
// import core from "../lib/lethil.js";

// const app = server();
var app;

// var requestUrl = "http://localhost:80";
describe("app.server", () => {
  before(() => {
    app = server();
    // core.server();
    // core.set.only('root','../evh-test-app');
    // core.set.only("port", 8087);
  });

  it("add route", () => {
    app.routes("/", "navPage").register("/", function (req, res) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.write("Hello World!");
      res.end();
    });
  });

  it("default port is 80", () => {
    assert.strictEqual(80, app.config.listen.port);
  });

  it("update port to 8099", () => {
    set.only("port", 8099);
    assert.strictEqual(8099, app.config.listen.port);
  });

  it("reset port", () => {
    set.only("port", 80);
    assert.strictEqual(80, app.config.listen.port);
  });

  it("default hostname is 127.0.0.1", () => {
    assert.strictEqual("127.0.0.1", app.config.listen.host);
  });

  it("update host to 0.0.0.0", () => {
    set.only("hostname", "0.0.0.0");
    assert.strictEqual("0.0.0.0", app.config.listen.host);
  });

  it("reset host", () => {
    set.only("hostname", "127.0.0.1");
    assert.strictEqual("127.0.0.1", app.config.listen.host);
    // console.log("app.config.listen", app.config.listen);
    // console.log("config.listen", config.listen);
  });

  // it("config.PORT is 2023", () => {
  //   assert.strictEqual(2023, config.PORT);
  // });

  it("listen ", () => {
    // app.listen(config.PORT, config.HOST, (error) => {
    //   console.log(config.PORT, config.HOST);
    //   assert.strict.ifError(error);
    //   done();
    // });
    app.listen(app.config.listen, () => {
      // if (typeof app.address == "object") {
      //   console.log("1", config.name, app.address.address, app.address.port);
      // } else {
      //   console.log("2", config.name, app.address);
      // }

      // assert.strictEqual("", config.name);
      // assert.strictEqual("127.0.0.1", app.address.address);
      // assert.strictEqual(80, app.address.port);
      // assert.strict.ifError(error);
      assert.ok(true);
      // assert.strictEqual(undefined, error);
      // done();
    });
  });

  // it("now listening 127.0.0.1:80", () => {
  //   assert.strictEqual("127.0.0.1", app.address.address);
  //   assert.strictEqual(80, app.address.port);
  // });

  it("response status: 200", () => {
    http.get(
      {
        host: app.config.listen.host,
        port: app.config.listen.port,
        path: "/",
        method: "GET",
      },
      function (res) {
        assert.strict.equal(200, res.statusCode);
      }
    );
  });
  it("response status: 404", () => {
    http
      .get(
        {
          host: app.config.listen.host,
          port: app.config.listen.port,
          path: "/none",
          method: "GET",
        },
        function (res) {
          // console.log("test.404", res);
          assert.strict.equal(404, res.statusCode);
          // assert.ok(true);
          // done();
        }
      )
      .on("error", (e) => {
        console.error(`Got error: ${e.message}`);
        // assert.ok(true);
        assert.ifError(e);
        // done();
      });
  });

  it("request", () => {
    http.get(
      {
        host: app.config.listen.host,
        port: app.config.listen.port,
        path: "/",
        method: "GET",
      },
      function (res) {
        var data = "";
        res.on("data", function (chunk) {
          data += chunk;
        });
        res.on("end", function () {
          assert.strict.equal(200, res.statusCode);
          assert.strict.equal("Hello World!", data);
        });
      }
    );
  });

  it("close", () => {
    app.close(function () {
      assert.ok(true);
    });
  });

  /**
   * process.exit()
   */
  after((done) => {
    // app.exit();
    done();
  });
});
