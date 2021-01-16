// import 'mocha';
import * as assert from 'assert';
import {burglish} from '../lib/service/index.js';

describe('Burglish', () => {

	it('toUnicode', async ()  => {
    const job = new burglish('ၾကင္နာေသာ');
    assert.strictEqual('ကြင်နာသော',job.toUnicode)
  });

	it('toZawgyi', async ()  => {
    const job = new burglish('ကြင်နာသော');
    assert.strictEqual('ၾကင္နာေသာ',job.toZawgyi)
  });

});