// import 'mocha';
import * as assert from 'assert';
import * as upgrade from '../lib/upgrade.js';

describe('Upgrade', () => {
	it('create', async ()  => {

    // console.log(job);
    // assert.ok(job);
    await upgrade.create();
    assert.ok(true);
    // assert.fail('expected exception not thrown'); // this throws an AssertionError

	});
	it('extract', async ()  => {
    await upgrade.extract();
	});

});