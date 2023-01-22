import * as check from "./check.js";
import * as seek from "./seek.js";
import * as load from "./load.js";
import * as parse from "./parse.js";

import * as route from "./route.js";
import * as array from "./array.js";
import * as object from "./object.js";

export const fire = { route: route, array: array, object: object };

export default {
  check,
  seek,
  load,
  parse,
  fire,
};
