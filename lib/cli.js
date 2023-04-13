import { Command } from "./framework/command.js";

/**
 * @namespace
 * @type {Command}
 * @example
 * node run hello
 * npm run hello
 */
let app;

/**
 * Application - command line interface
 *
 * It's all begin with your's app administration
 * @returns {Command}
 */
export default function command() {
  if (!app) {
    app = new Command();
  }
  return app;
}
