import "mocha";
import * as assert from "assert";
import { deploy } from "../lethil.mjs";

describe("Deployment", () => {
  it("Execute", async () => {
    assert.ok(typeof deploy.executeChildProcess == "function");
    assert.ok(typeof deploy.executeWithPromisify == "function");
  });
  it("deploy.environment", async () => {
    assert.ok(typeof deploy.environment.buildCommandLine == "function");
    assert.ok(typeof deploy.environment.transfer == "function");
  });
  it("deploy.ecosystem", async () => {
    assert.ok(typeof deploy.ecosystem.createOrUpdate == "function");
  });
});
