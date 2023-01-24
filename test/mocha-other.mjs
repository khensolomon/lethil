import "mocha";
import * as assert from "assert";

describe("Other", () => {
  it("tmp", async () => {
    assert.ok(true);
  });
});

/**
 * typedef {setting & config} Child
 * return {Child}
 */
// export function abc() {
// 	// var abcs = [...setting, config, ];
// 	var abcs = Object.assign(setting,config);
// 	return abcs;
// }

/**
 * @template T
 * @template [U = T]
 * @param { T } item
 * @param { function(T): U } [mapper = t => t]
 * @returns { U }
 */
// export function map(item, mapper = t => t) {
// 	return mapper(item);
// }

// const abc = map("123", parseInt);
