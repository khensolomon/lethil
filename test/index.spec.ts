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
		it('Init -> var server = new scriptive()', () => {
			assert.ok(server);
			// assert.ifError(server);
		});
		it('Set root -> server.root()', () => {
			server.root();
			assert.ok(rootSetting.root);
		});
		it('Set port -> server.port(4000)', () => {
			server.port('4000');
			assert.equal('4000',rootSetting.port);
		});
		it('Do listen -> server.listen()', () => {
			var tmp = server.listen().on('error',function(e:any){
				describe('...has error', () => {
					it('yes', () => assert.ifError(e));
				});
			}).on('close',function(){
				describe('...has closed', () => {
					it('yes', () => assert.ok(true));
				});
			}).on('listening',function(){
				describe('...was listening', () => {
					it('yes', () => assert.ok(true));
				});
			});
			// var tmp = server.listen();
			var address = tmp.address();
			var bind = typeof address === 'string'?'pipe:' + address:'port:' + address.port;
			assert.ok(bind);
		});
		it('On listening -> server.listening()', () => {
			server.listening();
		});
		it('On error -> server.error()', () => {
			server.error();
		});
		it('Do stop -> server.stop()', () => {
			server.stop();
		});
		it('On close -> server.close()', () => {
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

		server.listen().on('error',function(e:any){
		  console.log(e);
		}).on('close',function(){
		  console.log('closed');
		}).on('listening',function(){
		  console.log('listening');
		});
		server.listening();
		server.error((e:any)=>{
			assert.ifError(e);
		});
		assert.ifError(server.error());
		server.close(function(){
			console.log('closed 1 ');
		});
		server.stop();
		server.error();
		server.close();
	});
	*/
	it('rootSetting', () => {
		assert.ok(rootSetting.constructor === Object);
	});
	it('rootDirectory', () => {
		assert.ok(rootDirectory.constructor === Object);
	});
});