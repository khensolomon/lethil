// @ts-check

import * as ask from './ask.js';
import * as utility from './utility.js';
import timer from './timer.js';
import Burglish from './burglish.js';

/**
 * @param {string} str
 */
const burglish = (str) => new Burglish(str);

// export { ask,utility,timer,burglish };
export default { ask,utility,timer,burglish };