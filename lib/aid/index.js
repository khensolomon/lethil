// @ts-check

import check from './check.js';
import * as seek from './seek.js';
import * as load from './load.js';
import parse from './parse.js';

import arr from './array.js';
import obj from './object.js';

// export { check, seek, load, parse };

// export default { array:arr, object:obj };
export default { check, seek, load, parse, fire:{array:arr, object:obj} };
