import "mocha";
import * as assert from "assert";
import { parse } from "../lethil.mjs";

describe("parse.hostName*", () => {
  it("hostNameRegex(localhost.local) -> /^localhost.local$/i", () => {
    let job = parse.hostNameRegex("localhost.local");
    assert.strictEqual(/^localhost\.local$/i.toString(), job.toString());
  });

  it("hostNameRegex([a,b,c]) -> /a|b|c/i", () => {
    let job = parse.hostNameRegex(["a", "b", "c"]);
    assert.strictEqual(/a|b|c/i.toString(), job.toString());
  });

  it("hostNameRegex([host.com,*.host.com]) -> /host.com|([^.]+).host.com/i", () => {
    let job = parse.hostNameRegex(["host.com", "*.host.com"]);
    assert.strictEqual(
      /host\.com|([^.]+)\.host\.com/i.toString(),
      job.toString()
    );
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

describe("middle referer: ???", () => {
  it("https://myordbok.lethil.me/", () => {
    let ref = parse.url("https://myordbok.lethil.me/");
    let host = "myordbok.lethil.me";
    // res.locals.referer = req.headers.host == ref.host;
    assert.ok(ref.host == host);
  });
  it("http://localhost/", () => {
    let ref = parse.url("http://localhost/");
    let host = "localhost";
    // res.locals.referer = req.headers.host == ref.host;
    assert.ok(ref.host == host);
  });
  it("https://myordbok.lethil.me/api/suggestion?q=v", () => {
    let ref = parse.url("https://myordbok.lethil.me/api/suggestion?q=v");
    let host = "myordbok.lethil.me";
    // res.locals.referer = req.headers.host == ref.host;
    assert.ok(ref.host == host);
  });
  it("http://localhost/api/suggestion?q=v", () => {
    let ref = parse.url("http://localhost/api/suggestion?q=v");
    let host = "localhost";
    // res.locals.referer = req.headers.host == ref.host;
    assert.ok(ref.host == host);
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
