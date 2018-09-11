import evh, {scriptive,rootSetting,rootDirectory} from '../asset/';
import * as assert from 'assert';

import 'mocha';
// console.log(assert);
describe('evh', () => {
	it('Initial', () => {
		// console.log(scriptive);
		console.log(evh,process.env.NODE_ENV);
		assert.ok(evh);
		// assert.ok(evh.assignment.testing);
		// assert.equal('Ok',evh.testing);
		// NOTE: import * as evh from '../asset/';
		// assert.equal('Ok',evh.default.testing);
	});
	it('Server', () => {
		var server = new scriptive;
		// server.test();
		// NOTE: Optional
		server.root();
		server.port();

		server.start();
		server.listening();
		server.error((e:any)=>{
			assert.ifError(e);
		});
		assert.ifError(server.error());
		server.stop();
		// server.error();
		// server.close();
	});
	it('rootSetting', () => {
		assert.ok(rootSetting.constructor === Object);
	});
	it('rootDirectory', () => {
		assert.ok(rootDirectory.constructor === Object);
	});
});