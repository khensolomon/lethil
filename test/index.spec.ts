import evh, {scriptive,rootSetting,rootDirectory} from '../asset/';
import * as assert from 'assert';

import 'mocha';
// console.log(assert);
describe('evh', () => {
	it('Check', () => {
		// console.log(scriptive);
		// console.log(evh,process.env.NODE_ENV);
		assert.ok(evh);
		// assert.ok(evh.assignment.testing);
		// assert.equal('Ok',evh.testing);
		// NOTE: import * as evh from '../asset/';
		// assert.equal('Ok',evh.default.testing);
	});
	describe('Server', () => {
		var server = new scriptive();
		it('Init', () => {
			assert.ok(server);
			// assert.ifError(server);
		});
		it('Set root', () => {
			server.root();
			assert.ok(rootSetting.root);
		});
		it('Set port:4000', () => {
			server.port('4000');
			assert.equal('4000',rootSetting.port);
		});
		it('Do start', () => {
			var t1 = server.start();
			var address = t1.address();
			var bind = typeof address === 'string'?'pipe:' + address:'port:' + address.port;
			assert.ok(bind);
		});
		it('On listening http', () => {
			server.listening();
		});

		it('On error', () => {
			server.error();
		});
		it('Do stop', () => {
			server.stop();
		});
		it('On close', () => {
			server.close();
		});
	});
	/*
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
		server.close(function(){
			console.log('closed');
		});
	});
	*/
	it('rootSetting', () => {
		assert.ok(rootSetting.constructor === Object);
	});
	it('rootDirectory', () => {
		assert.ok(rootDirectory.constructor === Object);
	});
});