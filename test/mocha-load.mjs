import "mocha";
import * as assert from "assert";
import { load } from "../lethil.mjs";

describe("load.file", () => {
  it("has method", () => {
    // assert.strictEqual("function", typeof load.file);
    assert.ok(typeof load.file == "function");
  });
});

describe("load.json", () => {
  it("has method", () => {
    assert.ok(typeof load.json == "function");
  });
});

describe("load.env", () => {
  it("has method", () => {
    assert.ok(typeof load.env == "function");
  });
});

describe("load.module", () => {
  it("has method", () => {
    assert.ok(typeof load.module == "function");
  });
});
