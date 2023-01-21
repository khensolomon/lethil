import "mocha";
import * as assert from "assert";
import { fire } from "../lethil.mjs";

describe("fire.array", () => {
  const uniqueArgument = [10, 20, 20];
  const uniqueParam = JSON.stringify(uniqueArgument).replace(/"/g, "");
  it(`.unique(${uniqueParam}) -> [10,20]`, () => {
    let job = fire.array.unique(uniqueArgument);
    assert.strictEqual(2, job.length);
    assert.strictEqual(10, job[0]);
    assert.strictEqual(20, job[1]);
  });

  const groupArgument = [
    { term: 1, v: 10 },
    { term: 2, v: 20 },
    { term: 2, v: 70 },
    { term: 3, v: 22 },
    { term: 4, v: 30 },
  ];
  const groupParam = JSON.stringify(groupArgument).replace(/"/g, "");
  it(`.group(${groupParam}, term)`, () => {
    let job = fire.array.group(groupArgument, "term");
    // console.log(job);

    assert.strictEqual("object", typeof job);
    assert.strictEqual(undefined, job.length);
    assert.strictEqual(70, job["2"][1].v);
    assert.strictEqual(30, job["4"][0].v);
  });

  const categoryArgument = [
    { term: 1, v: 10 },
    { term: 2, v: 20 },
    { term: 2, v: 70 },
    { term: 3, v: 22 },
    { term: 4, v: 30 },
  ];
  const categoryParam = JSON.stringify(categoryArgument).replace(/"/g, "");
  it(`.category(${categoryParam}, o => o.term)`, () => {
    let job = fire.array.category(categoryArgument, (o) => o.term);
    // console.log(job);

    assert.strictEqual("object", typeof job);

    const toArray = Array.from(job, ([key, value]) => ({
      [key]: value,
    }));
    assert.strictEqual(4, toArray.length);
    assert.strictEqual(70, toArray[1]["2"][1].v);
    assert.strictEqual(30, toArray[3]["4"][0].v);
  });
});
