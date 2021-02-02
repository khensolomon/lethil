import 'mocha';
import * as assert from 'assert';
import {timer} from '../lib/service/index.js';

describe('Timer', () => {
	it('[10:00,00:22] isSeconds -> 10:22', async ()  => {
    const job = timer(['10:00','00:22']);
    const result = job.isSeconds().shorten();
    assert.strictEqual('10:22',result)
  });

	it('33 isSeconds -> 0:33', async ()  => {
    const job = timer(33);
    const result = job.isSeconds().shorten();
    assert.strictEqual('0:33',result)
  });

	it('12*1000 isMilliseconds -> 0:12', async ()  => {
    const job = timer(12*1000);
    const result = job.isMilliseconds().shorten();
    assert.strictEqual('0:12',result)
  });

	it('12*1000 isSeconds -> 40:00', async ()  => {
    const job = timer(12*200);
    const result = job.isSeconds().shorten();
    assert.strictEqual('40:00',result)
  });

	it('12*1000 isSeconds -> 40:00', async ()  => {
    const job = timer(12*200);
    const result = job.shorten();
    assert.strictEqual('40:00',result)
  });

	it('04:43 -> 4:43', async ()  => {
    const job = timer('04:43');
    const result = job.shorten();
    assert.strictEqual('4:43',result)
    // console.log(result);
    // assert.ok(true);
	});

});