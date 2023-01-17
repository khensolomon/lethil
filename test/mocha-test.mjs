import "mocha";
import * as assert from "assert";
import * as upgrade from "../dist/upgrade.js";

describe("Upgrade", () => {
  it("create", async () => {
    assert.ok(typeof upgrade.create == "function");
  });
});
