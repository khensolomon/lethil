import "mocha";
import * as assert from "assert";
import { command, set } from "../lethil.mjs";
// import {command, default as set} from '../lib/lethil.js';

const app = command();

describe("app.command", () => {
  before(() => {
    // app = command();
    // core.server();
    // core.set.only('root','../evh-test-app');
    // core.set.only('port',8086);
  });

  it("init", () => {
    set.only("root", "../evh-test-app");

    assert.ok(app);
    // assert.strict.ifError(app);
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
  after((done) => {
    app.close();
    // console.log('close')
    // process.exit()
    done();
  });
});
// app.root('/server/evh-test-app/.env');
// app.command().then(console.log).catch(console.log);
