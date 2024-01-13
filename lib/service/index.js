import * as ask from "./ask.js";
import * as utility from "./utility.js";
import Timer from "./timer.js";
import Burglish from "./burglish.js";
import Digit from "./digit.js";
import Prompt from "./prompt.js";

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

/**
 * Command line prompt
 */
// export const prompt = Prompt;
export const prompt = () => new Prompt();

export default { ask, utility, timer, burglish, digit, prompt };
