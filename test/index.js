// import 'mocha';
// import * as assert from 'assert';
import {uri} from '../lib/aid/parse.js';

var requestURL = '/foo/apple/sf/';
var pathURLBase = '/foo';
var pathURLDyanmic = '/foo/:id';
var pathURLDP = '/foo/:id?';

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

// var abc = uri('/foo/:id');
// console.log(abc,abc.test('/foo'));
// console.log(abc,abc.test('/foo/'));
// console.log(abc,abc.test('/foo/end-with-slash'));
// console.log(abc,abc.test('/foo/end-with-slash/more'));

var abc = uri('/foo/:id?');
console.log(abc,abc.test('/foo'));
console.log(abc,abc.test('/foo/'));
console.log(abc,abc.test('/foo/end-with-slash'));
console.log(abc,abc.test('/foo/end-with-slash/more'));

// var abc = uri('/foo/:id?/:name');
// console.log(abc,abc.test('/foo'));
// console.log(abc,abc.test('/foo/'));
// console.log(abc,abc.test('/foo/end-with-slash'));
// console.log(abc,abc.test('/foo/end-with-slash/more'));

// console.log(uri('/foo/:id/:name'),'/foo/slash/more'.match(uri('/foo/:id/:name')));
// console.log(uri('/foo/:id?/:name'),'/foo/slash/more'.match(uri('/foo/:id?/:name')));
// console.log(uri('/foo/:id/:name?/:val'),'/foo/slash/more/a'.match(uri('/foo/:id/:name?/:val')));
// console.log(uri('/foo/:id/:name/:val?'),'/foo/slash/more/a'.match(uri('/foo/:id/:name/:val?')));

// console.log(uri('/foo/:id/:name'));
// console.log(uri('/foo/:id?/:name'));
// console.log(uri('/foo/:id/:name?'));