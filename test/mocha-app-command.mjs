import "mocha";
import * as assert from "assert";
import { command, set } from "../lethil.mjs";

// const app = command();
var app;

describe("app.command", () => {
  before(() => {
    app = command();
    // core.server();
    // core.set.only('root','../evh-test-app');
    // core.set.only('port',8086);
  });

  // it("init", () => {
  //   set.only("root", "../evh-test-app");

  //   assert.ok(app);
  //   // assert.strict.ifError(app);
  // });

  it("add route", () => {
    app.routes().register("apple", function (req) {
      return "yes";
    });
  });

  // it('invalid directory should return "no Module found"', () => {
  //   set.only('root','../evh-test-app-invalid');
  //   let job = app.command();
  //   assert.strict.deepEqual('no Module found',job)
  // });

  // it('no Method found', async () => {
  //   app.root('/server/evh-test-app-invalid');
  //   let job = await app.command();
  //   assert.strict.deepEqual('no Method found',job)
  // });

  it("listen ", () => {
    app.listen((res) => {
      assert.strict.equal(undefined, res);
    });
  });

  it("close", () => {
    app.close(function (error) {
      // assert.ok(true);
      assert.strict.equal("No route exists", error);
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
