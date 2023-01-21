import "mocha";
import * as assert from "assert";
import core from "../lethil.mjs";
// import {command, default as set} from '../lib/lethil.js';

const app = core.command();

describe("app.command", () => {
  before(() => {
    // app = core.command();
    // core.server();
    // core.set('root','../evh-test-app');
    // core.set('port',8086);
  });

  it("init", () => {
    app.set("root", "../evh-test-app");

    assert.ok(app);
    // assert.strict.ifError(app);
  });

  // it('invalid directory should return "no Module found"', () => {
  //   app.set('root','../evh-test-app-invalid');
  //   let job = app.command();
  //   assert.strict.deepEqual('no Module found',job)
  // });

  // it('no Method found', async () => {
  //   app.root('/server/evh-test-app-invalid');
  //   let job = await app.command();
  //   assert.strict.deepEqual('no Method found',job)
  // });
  after((done) => {
    app.close();
    // console.log('close')
    // process.exit()
    done();
  });
});
// app.root('/server/evh-test-app/.env');
// app.command().then(console.log).catch(console.log);
