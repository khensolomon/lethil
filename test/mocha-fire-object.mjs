import "mocha";
import * as assert from "assert";
import { fire } from "../lethil.mjs";

describe("fire.object", () => {
  const mergeArgument = [
    { term: 1, v: "f" },
    { term: 2, v: "z" },
    { term: 4, v: "a" },
    { term: 3, v: "e" },
    { term: 2, v: "b" },
  ];
  const mergeParam = JSON.stringify(mergeArgument).replace(/"/g, "");
  it(`.merge(${mergeParam}): ?`, () => {
    let job = fire.object.merge(mergeArgument, "v");
    // console.log(job);
    assert.strictEqual(5, job.length);
    // assert.strictEqual(10, job[0]);
    // assert.strictEqual(20, job[1]);
    assert.ok(job);
  });

  const sortArgument = [
    { term: 4, v: "f" },
    { term: 2, v: "z" },
    { term: 2, v: "a" },
    { term: 3, v: "e" },
    { term: 1, v: "b" },
  ];
  const sortParam = JSON.stringify(sortArgument).replace(/"/g, "");

  describe(`.sort(${sortParam})`, () => {
    const sortJobString = fire.object.sort(sortArgument, 0, true);
    const sortParamString = JSON.stringify(sortJobString).replace(/"/g, "");
    it(`by number, 1st value of v: f, ${sortParamString}`, () => {
      // let sortJobString = fire.object.sort(sortArgument, 0, true);

      assert.strictEqual(5, sortJobString.length);
      assert.strictEqual("f", sortJobString[0][1].v);
    });

    const sortJobNumber = fire.object.sort(sortArgument, "v");
    const sortParamNumber = JSON.stringify(sortJobNumber).replace(/"/g, "");
    it(`by string, 1st value of v: a, ${sortParamNumber}`, () => {
      // let sortJobNumber = fire.object.sort(sortArgument, "v");

      assert.strictEqual(5, sortJobNumber.length);
      assert.strictEqual("a", sortJobNumber[0][1].v);
    });
  });

  const mergeTargetObject = {
    a: true,
    b: {
      a: 1,
      b: 2,
    },
    c: {},
  };
  const mergeSourceObject = {
    b: {
      x: true,
    },
  };
  const mergeTargetStringify = JSON.stringify(mergeTargetObject).replace(
    /"/g,
    ""
  );
  const mergeSourceStringify = JSON.stringify(mergeSourceObject).replace(
    /"/g,
    ""
  );
  describe(`.merge(${mergeTargetStringify},${mergeSourceStringify})`, () => {
    fire.object.merge(mergeTargetObject, mergeSourceObject);
    // console.log(mergeTargetObject);

    it(`target.b.x == true`, () => {
      assert.deepEqual(true, mergeTargetObject.b.x);
      // assert.ok(true);
    });
  });

  // it(`.getKeybyValue(?)`, () => {
  //   assert.ok(true);
  // });
  // it(`.getValuebyKey(?)`, () => {
  //   assert.ok(true);
  // });
});
