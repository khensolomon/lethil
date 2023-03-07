import { Command } from "./framework/command.js";

/**
 * @namespace
 * @type {Command}
 */
var app;

/**
 * Application - command line interface
 * @returns {Command}
 */
export default function command() {
  if (!app) {
    app = new Command();
  }
  return app;
}
