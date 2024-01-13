import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

/**
 * @example
 * const prompt = new Prompt();
 * const testament = await prompt.question("Testament: ");
 * const book = await prompt.question("Book: ");
 * prompt.close();
 * prompt.task.close();
 * let msg = `Testament ${testament}, book: ${book}`;
 */
export default class Prompt {
  constructor() {
    this.task = readline.createInterface({ input, output });
  }

  /**
   * @example
   * Testament:
   * Book:
   * @param {string} input
   * @returns {Promise<string>} answer
   */
  question(input) {
    return this.task.question(input);
  }

  /**
   * Close prompt
   */
  close() {
    return this.task.close();
  }
}

// /**
//  * @param {any} msg
//  */
// export function prompt(msg) {
//   fs.writeSync(1, String(msg));
//   let s = "",
//     buf = Buffer.alloc(1);
//   while (buf[0] - 10 && buf[0] - 13) (s += buf), fs.readSync(0, buf, 0, 1, 0);
//   return s.slice(1);
// }
