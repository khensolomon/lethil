import "mocha";
import * as assert from "assert";
import { ask } from "../lethil.mjs";

describe("ask.stream", () => {
  it("has method", () => {
    assert.strictEqual("function", typeof ask.stream);
  });
});

describe("ask.request", () => {
  it("has method", () => {
    assert.strictEqual("function", typeof ask.request);
  });
});

describe("ask.gistData", () => {
  it("has Class", () => {
    assert.strictEqual("function", typeof ask.gistData);
    // console.log("???", typeof ask.gistData);
    // assert.ok(typeof ask.gistData == "function");
    // assert.ok(true);
  });
});
