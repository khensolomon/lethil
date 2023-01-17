import { it } from "mocha";
import assert from "assert";
import { fire } from "../lethil.mjs";

const available = Object.keys(fire.route);

describe("fire.route: available", () => {
  it(available.join(", "), () => {
    assert.strictEqual(3, available.length);
    assert.ok(
      available.includes("pass") && typeof fire.route.pass == "function"
    );
    assert.ok(
      available.includes("test") && typeof fire.route.test == "function"
    );
    assert.ok(
      available.includes("match") && typeof fire.route.match == "function"
    );
  });
  // it('pass', () => {});
  // it('match', () => {});
  // it('test', () => {});
});

describe("fire.route: test", () => {
  // before(function(){})

  it("match /post == /post, /post/ != /posts, /post/none ", () => {
    let job = fire.route.pass("/post");
    assert.strictEqual(true, job.test("/post"));
    assert.strictEqual(true, job.test("/post/"));
    assert.strictEqual(false, job.test("/posts"));
    assert.strictEqual(false, job.test("/post/none"));
  });

  it("match /post/:id = /post/1, /post/string , /post/string/ != /post/string/none ", () => {
    let job = fire.route.pass("/post/:id");
    assert.strictEqual(true, job.test("/post/1"));
    assert.strictEqual(true, job.test("/post/str-ing"));
    assert.strictEqual(true, job.test("/post/str-ing/"));
    assert.strictEqual(true, job.test("/post/string/"));
    assert.strictEqual(false, job.test("/post"));
    assert.strictEqual(false, job.test("/post/"));
    assert.strictEqual(false, job.test("/post/string/none"));
  });

  it("match /post/:id? = /post, /post/, /post/1, /post/string , /post/string/ != /post/string/none ", () => {
    let job = fire.route.pass("/post/:id?");
    assert.strictEqual(true, job.test("/post"));
    assert.strictEqual(true, job.test("/post/"));
    assert.strictEqual(true, job.test("/post/1"));
    assert.strictEqual(true, job.test("/post/str-ing"));
    assert.strictEqual(true, job.test("/post/string/"));
    assert.strictEqual(true, job.test("/post/string/none"));
  });

  it("match /post/:id?/:name = ?", () => {
    let job = fire.route.pass("/post/:id?/:name");
    assert.strictEqual(true, job.test("/post"));
    assert.strictEqual(true, job.test("/post/"));
    assert.strictEqual(true, job.test("/post/1"));
    assert.strictEqual(true, job.test("/post/str-ing"));
    assert.strictEqual(true, job.test("/post/string/"));
    assert.strictEqual(true, job.test("/post/string/none"));
  });

  it("match /post/:id/:name? = ?", () => {
    let job = fire.route.pass("/post/:id/:name?");
    assert.strictEqual(false, job.test("/post"));
    assert.strictEqual(false, job.test("/post/"));
    assert.strictEqual(true, job.test("/post/1"));
    assert.strictEqual(true, job.test("/post/str-ing"));
    assert.strictEqual(true, job.test("/post/string/"));
    assert.strictEqual(true, job.test("/post/string/none"));
  });

  it("match /post/:id/:name/:val? = ?", () => {
    let job = fire.route.pass("/post/:id/:name/:val?");
    assert.strictEqual(false, job.test("/post"));
    assert.strictEqual(false, job.test("/post/"));
    assert.strictEqual(false, job.test("/post/1"));
    assert.strictEqual(false, job.test("/post/str-ing"));
    assert.strictEqual(false, job.test("/post/str-ing/"));
    assert.strictEqual(true, job.test("/post/string/none"));
    assert.strictEqual(true, job.test("/post/string/none/extra"));
  });

  it("param /foo/:id/:name -> /foo/slash/more/last", () => {
    /**
     * @type {any}
     */
    let job = "/foo/slash/more/last".match(
      fire.route.pass("/foo/:id/:name/:val?")
    );
    const params = job.groups;
    assert.strictEqual("slash", params.id);
    assert.strictEqual("more", params.name);
    assert.strictEqual("last", params.val);
  });

  it("param /foo/:id/:name? -> /foo/slash/", () => {
    /**
     * @type {any}
     */
    let job = "/foo/slash/".match(fire.route.pass("/foo/:id/:name?"));

    const params = job.groups;
    assert.strictEqual("slash", params.id);
    assert.strictEqual(undefined, params.name);
  });

  it("param /foo?id=value", () => {
    /**
     * @type {any}
     */
    // let job = '/foo'.match(fire.route.pass('/foo?id=value'));
    let job = fire.route.match("/foo?id=value", "/foo/:type?");
    const params = job.groups;
    assert.strictEqual("?id=value", params.type);
  });

  it("param /foo/apple?orange=true -> /foo/:fruit?", () => {
    /**
     * @type {any}
     */
    let job = fire.route.match("/foo/apple?orange=true", "/foo/:fruit?");
    const params = job.groups;
    assert.strictEqual("apple", params.fruit);
  });

  it("param /foo-:id -> /pos-noun", () => {
    /**
     * @type {any}
     */
    let job = "/foo-noun".match(fire.route.pass("/foo-:id"));
    const params = job.groups;
    assert.strictEqual("noun", params.id);
  });

  it("param /foo/:id/:name/:val? -> /foo/a/b", () => {
    /**
     * @type {any}
     */
    // console.log(parse.uri('/foo/:id/:name'),'/foo/slash/more'.match(parse.uri('/foo/:id/:name')));
    // console.log(parse.uri('/foo/:id?/:name'),'/foo/slash/more'.match(parse.uri('/foo/:id?/:name')));
    // console.log(parse.uri('/foo/:id/:name?/:val'),'/foo/slash/more/a'.match(parse.uri('/foo/:id/:name?/:val')));
    // console.log(parse.uri('/foo/:id/:name/:val?'),'/foo/slash/more/a'.match(parse.uri('/foo/:id/:name/:val?')));
    // let job = parse.uri('/post/:id/:name');

    let job = "/foo/a/b".match(fire.route.pass("/foo/:id/:name/:val?"));
    const params = job.groups;
    assert.strictEqual("a", params.id);
    assert.strictEqual("b", params.name);
    assert.strictEqual(undefined, params.val);
  });

  // foo/child/grand ->
});
