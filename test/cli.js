import * as assert from 'assert';
import app from '../lib/index.js';
// import {command, default as set} from '../lib/index.js';

describe('CLI', () => {
	it('init', async () => {
    app.root('../evh-test-app');
    let job = await app.command();
    assert.ok(job);
    // assert.strict.ifError(job);
  });

  it('invalid directory should return "no Module found"', async () => {
    app.root('../evh-test-app-invalid');
    let job = await app.command();
    assert.strict.deepEqual('no Module found',job)
	});

  // it('no Method found', async () => {
  //   app.root('/server/evh-test-app-invalid');
  //   let job = await app.command();
  //   assert.strict.deepEqual('no Method found',job)
	// });
});
// app.root('/server/evh-test-app/.env');
// app.command().then(console.log).catch(console.log);
