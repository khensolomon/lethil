import "mocha";
import * as assert from "assert";
import { utility } from "../lethil.mjs";

describe("utility.createUniqueId", () => {
  it("has method", () => {
    assert.ok(typeof utility.createUniqueId == "function");

    assert.notStrictEqual("", utility.createUniqueId());

    assert.notStrictEqual(
      "",
      utility.createUniqueId("xxxx-yy-xx-mm-yxxxxxxxxx")
    );
  });
});

describe("utility.timeCheck", () => {
  it("has method", () => {
    assert.ok(typeof utility.timeCheck == "function");
    // assert.notStrictEqual(500, utility.timeCheck(500));
  });
});
