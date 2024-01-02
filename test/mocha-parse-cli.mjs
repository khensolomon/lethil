import "mocha";
import * as assert from "assert";
import { parse } from "../lethil.mjs";

describe("parse.cli", function () {
  // process.argv.splice(2);

  it("bible search tedim --q 'Topa kiangah'", function () {
    let title = this.test?.title;
    let job = parse.cli(title);
    // const route = parse.url(job);
    // console.log(route);
    assert.strictEqual("/bible/search/tedim?q=Topa kiangah", job);
    // console.log(job);
  });
  it("bible search tedim --q 'Topa kiangah' b=0", function () {
    let title = this.test?.title;
    let job = parse.cli(title);
    // const route = parse.url(job);
    // console.log(route);
    assert.strictEqual("/bible/search/tedim?q=Topa kiangah&b=0", job);
    // console.log(job);
  });
  it("bible search tedim --q Topa kiangah", function () {
    let title = this.test?.title;
    let job = parse.cli(title);
    assert.strictEqual("/bible/search/tedim?q=Topa kiangah", job);
  });
  it("bible search tedim?q=Topa kiangah", function () {
    let title = this.test?.title;
    let job = parse.cli(title);
    assert.strictEqual("/bible/search/tedim?q=Topa kiangah", job);
  });

  it("npm run script param", function () {
    let title = this.test?.title;
    let splice = title?.split(" ");
    let job = parse.cli(splice);
    assert.strictEqual("/npm/run/script/param", job);
  });

  it("node run third third", function () {
    let title = this.test?.title;
    let splice = title?.split(" ");
    let job = parse.cli(splice);
    assert.strictEqual("/node/run/third/third", job);
  });

  it("node run first second", function () {
    let title = this.test?.title;
    let splice = title?.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first/second", job);
    assert.ok(true);
  });

  it("node run none --second", function () {
    let title = this.test?.title;
    let splice = title?.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/none", job);
  });

  it("node run first --q=love k=key", function () {
    let title = this.test?.title;
    let splice = title?.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first?q=love&k=key", job);
  });

  it("node run first --q=love --k=key", function () {
    let title = this.test?.title;
    let splice = title?.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first?q=love&k=key", job);
  });

  it("node run first?q=love --k=key", function () {
    let title = this.test?.title;
    let splice = title?.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first?q=love&k=key", job);
  });

  it("node run first?q=love&k=key", function () {
    let title = this.test?.title;
    let splice = title?.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first?q=love&k=key", job);
  });

  it("node run first q=love k=key", function () {
    let title = this.test?.title;
    let splice = title?.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/first/q=love/k=key", job);
  });

  it("npm run none-param --q a --k=b", function () {
    let title = this.test?.title;
    let splice = title?.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/none-param?q=a&k=b", job);
  });

  it("npm run gist request list --file /abc/org boolen=false", function () {
    let title = this.test?.title;
    let splice = title?.split(" ").splice(2);
    let job = parse.cli(splice);
    assert.strictEqual("/gist/request/list?file=/abc/org&boolen=false", job);
  });

  it("bible search tedim?q=Topa", function () {
    let title = this.test?.title;
    // let splice = title?.split(" ").splice(2);
    let job = parse.cli(title);
    assert.strictEqual("/bible/search/tedim?q=Topa", job);
    // console.log(job);
  });

  it("bible search tedim --q='Topa kiangah'", function () {
    // node run bible search tedim --keyword='Topa kiangah'
    let title = this.test?.title;
    // let splice = title?.split(" ").splice(2);
    let job = parse.cli(title);
    assert.strictEqual("/bible/search/tedim?q=Topa kiangah", job);
    // console.log(job);
  });
  it("bible search tedim --keyword='k w' k=a b", function () {
    // node run bible search tedim --keyword='Topa kiangah'
    let title = this.test?.title;
    // let splice = title?.split(" ").splice(2);
    let job = parse.cli(title);
    assert.strictEqual("/bible/search/tedim?keyword=k w&k=a b", job);
    // console.log(job);
  });
  it("bible search tedim?keyword='k w'&k='a b'", function () {
    // node run bible search tedim --keyword='Topa kiangah'
    let title = this.test?.title;
    // let splice = title?.split(" ").splice(2);
    let job = parse.cli(title);
    assert.strictEqual("/bible/search/tedim?keyword=k w&k=a b", job);
    // console.log(job);
  });
  it("bible search tedim?q='k w' k='a b'", function () {
    // node run bible search tedim --q='Topa kiangah'
    let title = this.test?.title;
    // let splice = title?.split(" ").splice(2);
    let job = parse.cli(title);
    assert.strictEqual("/bible/search/tedim?q=k w&k=a b", job);
  });
  it("reference?q='Gen.1:3;Gen.2:3'", function () {
    // node run bible search tedim --q='Gen.1:3;Gen.2:3'
    let title = this.test?.title;
    // let splice = title?.split(" ").splice(2);
    let job = parse.cli(title);
    assert.strictEqual("/reference?q=Gen.1:3;Gen.2:3", job);
    // console.log(job);
  });
});
