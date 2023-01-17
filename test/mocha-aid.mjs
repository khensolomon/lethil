import "mocha";
import * as assert from "assert";
import { parse, fire } from "../lethil.mjs";

describe("Parse", () => {
  it("parse.uri(/post/:id) -> /post/345 is {id: 345}", () => {
    let requestURL = "/post/345";
    let job = fire.route.pass("/post/:id");
    /**
     * @type {any} reg - to avoid 'reg' is possibly 'null'
     */
    const reg = requestURL.match(job);
    const params = reg.groups;

    assert.ok(job.test(requestURL));
    assert.strictEqual("345", params?.id);
  });

  it("parse.uri(/post/title)", () => {
    let requestURL = "/post/title";
    let job = fire.route.pass(requestURL).test("/post/title");
    assert.ok(job);
  });

  // it('parse.uri(/post/:id)', () => {
  //   let requestURL = '/post/ww';
  //   let job = parse.uri(requestURL).test('/post/:id');
  //   assert.ok(job);
  // });

  it("parse.uri(/post/:id?) -> /post", () => {
    let job = fire.route.pass("/post/:id?");
    assert.ok(job.test("/post"));
    assert.ok(job.test("/post/14"));
  });

  // it('parse.query(?k=33&t2=string) -> {k:33,t2:string}', () => {
  // 	let job = parse.query('?k=33&t2=string');
  //   assert.strictEqual("33",job.k);
  //   assert.strictEqual("string",job.t2);
  // });
});

describe("Parse.hostName", () => {
  it("hostNameRegex(localhost.local) -> /^localhost.local$/i", () => {
    let job = parse.hostNameRegex("localhost.local");
    assert.strictEqual(/^localhost\.local$/i.toString(), job.toString());
  });

  it("hostNameExec(*.example.com) -> example.com", () => {
    let job = parse.hostNameExec("http://www.*.example.com");
    assert.strictEqual("example.com", job);
  });
});

describe("Parse.url", () => {
  it("url(http://example.com) -> example.com;", () => {
    let job = parse.url("http://example.com");
    assert.strictEqual("example.com", job.host);
  });

  it("url(http://localhost:90/about) -> localhost:90", () => {
    let job = parse.url("http://localhost:90/about");
    assert.strictEqual("localhost:90", job.host);
  });

  it("url(https://localhost:443/test) -> localhost", () => {
    let job = parse.url("https://localhost:443/test");
    assert.strictEqual("localhost", job.host);
  });
});

describe("Parse.context", () => {
  it("parse.context(a:1;b:2;c:3) -> {a:1,b:2,c:3}", () => {
    let job = parse.context("a:1;b:2;c:3");
    assert.strictEqual(
      JSON.stringify({ a: "1", b: "2", c: "3" }),
      JSON.stringify(job)
    );
  });
});

describe("aid.fire.array", () => {
  it("aid.fire.array.unique([1,2,2]) -> [1,2]", () => {
    let job = fire.array.unique([1, 2, 2]);
    assert.strictEqual(2, job.length);
  });
});

describe("words [aid.parse.explode, aid.parse.count]", () => {
  it("aid.parse.explode(1 2 3) -> [1,2,3]", () => {
    let job = parse.explode("1 2 3");
    assert.strictEqual(3, job.length);
    assert.strictEqual(JSON.stringify(["1", "2", "3"]), JSON.stringify(job));
  });

  it("aid.parse.count(1 2 3) -> 3", () => {
    let job = parse.count("1 2 3");
    assert.strictEqual(3, job);
  });
});
