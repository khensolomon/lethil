import "mocha";
import * as assert from "assert";
import { digit } from "../lethil.mjs";

describe("digit", () => {
  it("10000 -> 10k", async () => {
    const job = digit("10000");
    const result = job.shorten();
    assert.strictEqual("10k", result);
  });
});
