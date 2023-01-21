import "mocha";
import * as assert from "assert";
import { seek } from "../lethil.mjs";

describe("seek.posix", () => {
  it("has method", () => {
    assert.ok(typeof seek.posix == "function");
    assert.strictEqual("a/b", seek.posix(["a", "b"]));
  });
});

describe("seek.file", () => {
  it("has method", () => {
    assert.ok(typeof seek.file == "function");
  });
});

describe("seek.dir", () => {
  it("has method", () => {
    assert.ok(typeof seek.dir == "function");
  });
});

describe("seek.directory", () => {
  it("has method", () => {
    assert.ok(typeof seek.directory == "function");
  });
});

describe("seek.exists", () => {
  it("has method", () => {
    assert.ok(typeof seek.exists == "function");
  });
});

describe("seek.resolve", () => {
  it("has method", () => {
    assert.ok(typeof seek.resolve == "function");
  });
});

describe("seek.extname", () => {
  it("has method", () => {
    assert.ok(typeof seek.extname == "function");
  });
});

describe("seek.read", () => {
  it("has method", () => {
    assert.ok(typeof seek.read == "function");
  });
});

describe("seek.readSync", () => {
  it("has method", () => {
    assert.ok(typeof seek.readSync == "function");
  });
});

describe("seek.readStream", () => {
  it("has method", () => {
    assert.ok(typeof seek.readStream == "function");
  });
});

describe("seek.write", () => {
  it("has method", () => {
    assert.ok(typeof seek.write == "function");
  });
});

describe("seek.writeSync", () => {
  it("has method", () => {
    assert.ok(typeof seek.writeSync == "function");
  });
});

describe("seek.writeStream", () => {
  it("has method", () => {
    assert.ok(typeof seek.writeStream == "function");
  });
});

describe("seek.watch", () => {
  it("has method", () => {
    assert.ok(typeof seek.watch == "function");
  });
});

describe("seek.statSync", () => {
  it("has method", () => {
    assert.ok(typeof seek.statSync == "function");
  });
});
