import "mocha";
import * as assert from "assert";
import { check } from "../lethil.mjs";

describe("check.object(obj)", () => {
  it("is Object", () => {
    const a = check.object(Object.create({}));
    assert.ok(a);

    const b = check.object({});
    assert.ok(b);

    const c = check.object([]);
    assert.strictEqual(true, c);
  });
});

describe("check.array(arr)", () => {
  it("is Array", () => {
    const a = check.array([]);
    assert.ok(a);

    const b = check.array("[]");
    assert.strictEqual(false, b);
  });
});

describe("check.function(fn)", () => {
  it("is Function", () => {
    const a = check.function(() => {});
    assert.ok(a);

    const b = check.function("() => {}");
    assert.strictEqual(false, b);
  });
});

describe("check.string(str)", () => {
  it("is String", () => {
    const a = check.string("12");
    assert.ok(a);

    const b = check.string(123);
    assert.strictEqual(false, b);
  });
});

describe("check.number(num)", () => {
  it("is Number", () => {
    const a = check.number("12");
    assert.ok(a);

    const b = check.number(123);
    assert.strictEqual(true, b);
  });
});
