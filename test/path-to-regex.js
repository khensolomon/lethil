import 'mocha';
import * as assert from 'assert';
import aid from '../lib/aid/index.js';
// import 'mocha';
// import * as assert from 'assert';
// import {parse} from '../lib/aid/index.js';

describe('Path to regx', () => {

	it('match /post == /post, /post/ != /posts, /post/none ', () => {
    let job = aid.parse.uri('/post');
    assert.strictEqual(true,job.test('/post'));
    assert.strictEqual(true,job.test('/post/'));
    assert.strictEqual(false,job.test('/posts'));
    assert.strictEqual(false,job.test('/post/none'));
  });

	it('match /post/:id = /post/1, /post/string , /post/string/ != /post/string/none ', () => {
    let job = aid.parse.uri('/post/:id');
    assert.strictEqual(true,job.test('/post/1'));
    assert.strictEqual(true,job.test('/post/str-ing'));
    assert.strictEqual(true,job.test('/post/str-ing/'));
    assert.strictEqual(true,job.test('/post/string/'));
    assert.strictEqual(false,job.test('/post'));
    assert.strictEqual(false,job.test('/post/'));
    assert.strictEqual(false,job.test('/post/string/none'));
  });

  it('match /post/:id? = /post, /post/, /post/1, /post/string , /post/string/ != /post/string/none ', () => {
    let job = aid.parse.uri('/post/:id?');
    assert.strictEqual(true,job.test('/post'));
    assert.strictEqual(true,job.test('/post/'));
    assert.strictEqual(true,job.test('/post/1'));
    assert.strictEqual(true,job.test('/post/str-ing'));
    assert.strictEqual(true,job.test('/post/string/'));
    assert.strictEqual(true,job.test('/post/string/none'));
  });

  it('match /post/:id?/:name = ?', () => {
    let job = aid.parse.uri('/post/:id?/:name');
    assert.strictEqual(true,job.test('/post'));
    assert.strictEqual(true,job.test('/post/'));
    assert.strictEqual(true,job.test('/post/1'));
    assert.strictEqual(true,job.test('/post/str-ing'));
    assert.strictEqual(true,job.test('/post/string/'));
    assert.strictEqual(true,job.test('/post/string/none'));
  });

  it('match /post/:id/:name? = ?', () => {
    let job = aid.parse.uri('/post/:id/:name?');
    assert.strictEqual(false,job.test('/post'));
    assert.strictEqual(false,job.test('/post/'));
    assert.strictEqual(true,job.test('/post/1'));
    assert.strictEqual(true,job.test('/post/str-ing'));
    assert.strictEqual(true,job.test('/post/string/'));
    assert.strictEqual(true,job.test('/post/string/none'));
  });

  it('match /post/:id/:name/:val? = ?', () => {
    let job = aid.parse.uri('/post/:id/:name/:val?');
    assert.strictEqual(false,job.test('/post'));
    assert.strictEqual(false,job.test('/post/'));
    assert.strictEqual(false,job.test('/post/1'));
    assert.strictEqual(false,job.test('/post/str-ing'));
    assert.strictEqual(false,job.test('/post/str-ing/'));
    assert.strictEqual(true,job.test('/post/string/none'));
    assert.strictEqual(true,job.test('/post/string/none/extra'));
  });

  it('param /foo/:id/:name -> /foo/slash/more/last', () => {
    let job = '/foo/slash/more/last'.match(aid.parse.uri('/foo/:id/:name/:val?'));
    const params = job.groups;
    assert.strictEqual('slash',params.id);
    assert.strictEqual('more',params.name);
    assert.strictEqual('last',params.val);
  });

  it('param /foo/:id/:name? -> /foo/slash/', () => {
    let job = '/foo/slash/'.match(aid.parse.uri('/foo/:id/:name?'));
    const params = job.groups;
    assert.strictEqual('slash',params.id);
    assert.strictEqual(undefined,params.name);
  });

  // it('param /pos-:id', () => {
  //   let job = '/pos-noun'.match(aid.parse.uri('/pos-:id'));
  //   // const params = job.groups;
  //   // assert.strictEqual('noun',params.id);
  //   console.log(job);
  // });

  it('param /foo/:id/:name/:val? -> /foo/a/b', () => {
    // console.log(parse.uri('/foo/:id/:name'),'/foo/slash/more'.match(parse.uri('/foo/:id/:name')));
    // console.log(parse.uri('/foo/:id?/:name'),'/foo/slash/more'.match(parse.uri('/foo/:id?/:name')));
    // console.log(parse.uri('/foo/:id/:name?/:val'),'/foo/slash/more/a'.match(parse.uri('/foo/:id/:name?/:val')));
    // console.log(parse.uri('/foo/:id/:name/:val?'),'/foo/slash/more/a'.match(parse.uri('/foo/:id/:name/:val?')));
    // let job = parse.uri('/post/:id/:name');

    let job = '/foo/a/b'.match(aid.parse.uri('/foo/:id/:name/:val?'));
    const params = job.groups;
    assert.strictEqual('a',params.id);
    assert.strictEqual('b',params.name);
    assert.strictEqual(undefined,params.val);
  });

  // foo/child/grand ->

});

// var a = '/foos';
// var a = '/foo';
// var a = '/foo/child';
// var a = '/foo/child/grand';
// var regx = /^[\/]?foo\/child\/grand[\/]?$/;

// var regx = /^[\/]?foo($|\/child[^$/]+)?($|\/grand[^$/]+)?/;

// var regx = /^[\/]?foo($|\/[^$/]+)?($|\/[^$/]+)\.*/;
// var regx = /^[\/]?$|\/[^$/]+\.*/;

// console.log(regx.test(a));
// var requestURL = '/foo/apple/sf/';
// var pathURLBase = '/foo';
// var pathURLDyanmic = '/foo/:id';
// var pathURLDP = '/foo/:id?';

// var regx = /^[\/]?foo\/([^\/]+)?[\/]?/;
// var r1 = new RegExp(regx).test(requestURL);
// var r2 = new RegExp(regx).test('/foo/');
// var r3 = new RegExp(regx).test('/foo');
// console.log(r1,r2,r3);
// /**
//  *
//  * @param {*} pathURL
//  * @param {*} requestURL
//  */
// function testing(requestURL,pathURL,expected) {
//   var reg = uri(pathURL);
//   console.log('\n',requestURL,pathURL);
//   console.log(reg);
//   var result = reg.test(requestURL) == expected;
//   if (result == false){

//     console.log('result',reg.test(requestURL),'expected',expected);
//   }
//   // console.log(r.match(reg));
//   // console.log('---',reg.test(r) == expected);
// }

// testing('/foo/','/foo',true);
// testing('/foo/','/foo/',true);
// testing('/foo','/foo/',true);
// testing('/foo','/foo',true);


// testing('/foos','/foo/',false);
// testing('/foo/','/foo/',true);
// testing('/foo','/foo/',true);
// testing('/foo/','/foo/',true);
// testing('/foo/none','/foo/',false);

// testing('/foo','/foo/:id',false);
// testing('/foo/ok','/foo/:id',true);
// testing('/foo/','/foo/:id',false);
// testing('/foo/abc-xyz','/foo/:id',true);
// testing('/foo/slash-end/','/foo/:id',true);
// testing('/foo/abc-xyz/apple/','/foo/:id',false);


// testing('/foo/abc-xyz/apple/','/foo/:id?',true);
// testing('/foo','/foo/:id?',true);
// testing('/foo/a-b','/foo/:id?',true);
// testing('/foo/a-b/','/foo/:id?',true);



// console.log(uri('/foo'));
// console.log(uri('/foo/testing'));
// console.log(uri('/foo/:id'));
// console.log(uri('/foo/:id/:name'));

// console.log(uri('/foo').test('/foo/'));
// console.log(uri('/foo/').test('/foo/'));
// console.log(uri('/foo').test('/foo/testing'));
// console.log(uri('/foo/:id').test('/foo/testing'));
// console.log(uri('/foo/:id').test('/foo/testing/none'));
// console.log(uri('/foo/:id').test('/foo/'));

// var abc = uri('/foo');
// console.log(abc,abc.test('/foo'));
// console.log(abc,abc.test('/foo/'));
// console.log(abc,abc.test('/foos'));
// console.log(abc,abc.test('/foo/end-with-slash'));
// console.log(abc,abc.test('/foo/end-with-slash/more'));

// var abc = uri('/foo/');
// console.log(abc,abc.test('/foo'));
// console.log(abc,abc.test('/foo/'));
// console.log(abc,abc.test('/foo/end-with-slash'));
// console.log(abc,abc.test('/foo/end-with-slash/more'));

// var abc = parse.uri('/foo/:id');
// console.log(abc,abc.test('/foo'));
// console.log(abc,abc.test('/foo/'));
// console.log(abc,abc.test('/foo/end-with-slash'));
// console.log(abc,abc.test('/foo/end-with-slash/more'));

// var abc = parse.uri('/foo/:id?');
// console.log(abc,abc.test('/foo'));
// console.log(abc,abc.test('/foo/'));
// console.log(abc,abc.test('/foo/end-with-slash'));
// console.log(abc,abc.test('/foo/end-with-slash/more'));

// var abc = parse.uri('/foo/:id?/:name');
// console.log(abc,abc.test('/foo'));
// console.log(abc,abc.test('/foo/'));
// console.log(abc,abc.test('/foo/end-with-slash'));
// console.log(abc,abc.test('/foo/end-with-slash/more'));

// console.log(parse.uri('/foo/:id/:name'),'/foo/slash/more'.match(parse.uri('/foo/:id/:name')));
// console.log(parse.uri('/foo/:id?/:name'),'/foo/slash/more'.match(parse.uri('/foo/:id?/:name')));
// console.log(parse.uri('/foo/:id/:name?/:val'),'/foo/slash/more/a'.match(parse.uri('/foo/:id/:name?/:val')));
// console.log(parse.uri('/foo/:id/:name/:val?'),'/foo/slash/more/a'.match(parse.uri('/foo/:id/:name/:val?')));

// console.log(uri('/foo/:id/:name'));
// console.log(uri('/foo/:id?/:name'));
// console.log(uri('/foo/:id/:name?'));