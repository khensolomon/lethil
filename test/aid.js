import 'mocha';
import * as assert from 'assert';
import {parse, default as fire} from '../lib/aid/index.js';

describe('Parse', () => {

	it('parse.uri(/post/:id) -> /post/345 is {id: 345}', () => {
    let requestURL = '/post/345';
    let job = parse.uri('/post/:id');
    const reg = requestURL.match(job);
    const params = reg.groups;

    assert.ok(job.test(requestURL));
    assert.strictEqual('345',params?.id);
  });

	it('parse.uri(/post/title)', () => {
    let requestURL = '/post/title';
    let job = parse.uri(requestURL).test('/post/title');
    assert.ok(job);
  });

	// it('parse.uri(/post/:id)', () => {
  //   let requestURL = '/post/ww';
  //   let job = parse.uri(requestURL).test('/post/:id');
  //   assert.ok(job);
  // });

  it('parse.uri(/post/:id?) -> /post', () => {
    let job = parse.uri('/post/:id?');
    assert.ok(job.test('/post'));
    assert.ok(job.test('/post/14'));
  });

  // it('parse.query(?k=33&t2=string) -> {k:33,t2:string}', () => {
	// 	let job = parse.query('?k=33&t2=string');
  //   assert.strictEqual("33",job.k);
  //   assert.strictEqual("string",job.t2);
  // });

});

describe('Parse.hostName', () => {
	it('hostNameRegex(localhost.local) -> /^localhost\.local$/i', () => {
    let job = parse.hostNameRegex('localhost.local');
    assert.strictEqual((/^localhost\.local$/i).toString(),job.toString());
  });

	it('hostNameExec(*.example.com) -> example.com', () => {
    let job = parse.hostNameExec('http://www.*.example.com');
    assert.strictEqual('example.com',job);
  });
});

describe('Parse.context', () => {
  it('parse.context(a:1;b:2;c:3) -> {a:1,b:2,c:3}', () => {
    let job = parse.context('a:1;b:2;c:3');
    assert.strictEqual(JSON.stringify({a:"1",b:"2",c:"3"}),JSON.stringify(job));
  });
});

describe('fire.array', () => {
	it('fire.array.unique([1,2,2]) -> [1,2]', () => {
    let job = fire.array.unique([1,2,2]);
    assert.strictEqual(2,job.length);
  });
});

describe('words', () => {
	it('parse.explode(1 2 3) -> [1,2,3]', () => {
    let job = parse.explode('1 2 3');
    assert.strictEqual(3,job.length);
    assert.strictEqual(JSON.stringify(["1","2","3"]),JSON.stringify(job));
  });

	it('parse.count(1 2 3) -> 3', () => {
    let job = parse.count('1 2 3');
    assert.strictEqual(3,job);
  });

});
