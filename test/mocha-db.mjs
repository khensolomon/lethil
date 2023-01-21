import "mocha";
import * as assert from "assert";
import { db } from "../lethil.mjs";

describe("db.mysql", () => {
  // console.log("???", typeof db.mysql);
  it("has Class", async () => {
    assert.strictEqual("object", typeof db.mysql);
  });
});

describe("db.mongo", () => {
  it("has Class", async () => {
    assert.strictEqual("object", typeof db.mongo);
  });
});
