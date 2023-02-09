import "mocha";
import * as assert from "assert";
import { parse } from "../lethil.mjs";

describe("parse.hostName*", () => {
  it("hostNameRegex(localhost.local) -> /^localhost.local$/i", () => {
    let job = parse.hostNameRegex("localhost.local");
    assert.strictEqual(/^localhost\.local$/i.toString(), job.toString());
  });

  it("hostNameExec(*.example.com) -> example.com", () => {
    let job = parse.hostNameExec("http://www.*.example.com");
    assert.strictEqual("example.com", job);
  });
});

describe("parse.url", () => {
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

describe("parse.context", () => {
  it("parse.context(a:1;b:2;c:3) -> {a:1,b:2,c:3}", () => {
    let job = parse.context("a:1;b:2;c:3");
    assert.strictEqual(
      JSON.stringify({ a: "1", b: "2", c: "3" }),
      JSON.stringify(job)
    );
  });
});

describe("parse.explode", () => {
  it("explode(1 2 3) -> [1,2,3]", () => {
    let job = parse.explode("1 2 3");
    assert.strictEqual(3, job.length);
    assert.strictEqual(JSON.stringify(["1", "2", "3"]), JSON.stringify(job));
  });
});

describe("parse.count", () => {
  it("count(1 2 3) -> 3", () => {
    let job = parse.count("1 2 3");
    assert.strictEqual(3, job);
  });
});

describe("parse.cli", function () {
  // process.argv.splice(2);

  it("npm run script param", function () {
    // @ts-ignore
    let title = this.test.title;
    let splice = title.split(" ");
    let job = parse.cli(splice);
    assert.strictEqual("/npm?run&script&param", job);
  });

  it("node run first second", function () {
    // @ts-ignore
    let title = this.test.title;
    let splice = title.split(" ");
    let job = parse.cli(splice);
    assert.strictEqual("/node?run&first&second", job);
  });

  it("node run first second", function () {
    // @ts-ignore
    let title = this.test.title;
    let splice = title.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first?second", job);
    assert.ok(true);
  });

  it("node run first --second", function () {
    // @ts-ignore
    let title = this.test.title;
    let splice = title.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first?second", job);
  });

  it("node run first --q:love k=key", function () {
    // @ts-ignore
    let title = this.test.title;
    let splice = title.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first?q=love&k=key", job);
  });

  it("node run first --q:love --k=key", function () {
    // @ts-ignore
    let title = this.test.title;
    let splice = title.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first?q=love&k=key", job);
  });

  it("node run first?q=love&k=key", function () {
    // @ts-ignore
    let title = this.test.title;
    let splice = title.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first?q=love&k=key", job);
  });

  it("node run first q=love k=key", function () {
    // @ts-ignore
    let title = this.test.title;
    let splice = title.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first?q=love&k=key", job);
  });

  it("npm run first --q --k", function () {
    // @ts-ignore
    let title = this.test.title;
    let splice = title.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first?q&k", job);
    // console.log(job);
    // assert.ok(true);
  });
});
