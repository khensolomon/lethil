import "mocha";
import * as assert from "assert";
import { check } from "../lethil.mjs";

describe("check.isObject(obj)", () => {
  it("is Object", () => {
    const a = check.isObject(Object.create({}));
    assert.ok(a);

    const b = check.isObject({});
    assert.ok(b);

    const c = check.isObject([]);
    assert.strictEqual(true, c);
  });
});

describe("check.isArray(arr)", () => {
  it("is Array", () => {
    const a = check.isArray([]);
    assert.ok(a);

    const b = check.isArray("[]");
    assert.strictEqual(false, b);
  });
});

describe("check.isFunction(fn)", () => {
  it("is Function", () => {
    const a = check.isFunction(() => {});
    assert.ok(a);

    const b = check.isFunction("() => {}");
    assert.strictEqual(false, b);
  });
});

describe("check.isString(str)", () => {
  it("is String", () => {
    const a = check.isString("12");
    assert.ok(a);

    const b = check.isString(123);
    assert.strictEqual(false, b);
  });
});

describe("check.isNumber(num)", () => {
  it("is Number", () => {
    const a = check.isNumber("12");
    assert.ok(a);

    const b = check.isNumber(123);
    assert.strictEqual(true, b);
  });
});
