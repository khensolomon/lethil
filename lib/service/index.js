import * as ask from "./ask.js";
import * as utility from "./utility.js";
import Timer from "./timer.js";
import Burglish from "./burglish.js";
import Digit from "./digit.js";

/**
 * @param {any} time
 */
export const timer = (time) => new Timer(time);
/**
 * @param {string} str
 */
export const burglish = (str) => new Burglish(str);
/**
 * @param {number} str
 */
export const digit = (str) => new Digit(str);

// export { ask,utility,timer,burglish };
export default { ask, utility, timer, burglish, digit };

// export default { check, seek, load, parse, fire:{array:arr, object:obj} };
