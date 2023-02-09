"use strict";

import aid from "./aid/index.js";

import service from "./service/index.js";
import * as deployment from "./deployment/index.js";

/**
 * Deployments API and its related
 *
 * Creating `ecosystem.json`,
 * Transfer `.env`
 */
export const deploy = deployment;

import * as $ from "./framework/index.js";
import gui from "./gui.js";
import cli from "./cli.js";

/**
 * Database connection
 */
export const db = $.db;

/**
 * Configuration
 */
export const config = $.config.app;

/**
 * Parameter
 */
export const param = $.config.param;

/**
 * set Configuration
 */
export const set = $.init;

// init.set("root", 1);

/**
 * Server - GUI
 */
export const server = gui;

/**
 * Command - CLI
 * @example
 * node run hello
 * npm run hello
 */
export const command = cli;

/**
 * Routing
 * @alias $.route
 */
export const route = $.route;

/**
 * Working with object, array, text and number.
 * Validate provide xss or it's filter/validate
 * @alias aid.check
 */
export const check = aid.check;

/**
 * Working with files .env, package.json and other
 * @alias aid.load
 */
export const load = aid.load;

/**
 * Parser
 * @alias aid.parse
 */
export const parse = aid.parse;

/**
 * Working with files and directory
 * @alias aid.seek
 */
export const seek = aid.seek;

/**
 * String(routeName), Object and Array manipulation
 * @alias aid.fire
 */
export const fire = aid.fire;

/**
 * Services utilities
 * @alias service.utility
 */
export const utility = service.utility;

/**
 * Services http/s
 * @alias service.ask
 */
export const ask = service.ask;

/**
 * Services time convertor
 * @alias service.timer
 */
export const timer = service.timer;

/**
 * Services burglish
 * @alias service.burglish
 */
export const burglish = service.burglish;

/**
 * Lethil framework
 * @module lethil
 * @namespace lethil - framework for CLI & GUI
 */
const lethil = {
  set,
  db,
  config,
  route,
  command,
  server,
  check,
  load,
  parse,
  seek,
  fire,
  utility,
  ask,
  timer,
  burglish,
};

export default lethil;
// module.exports = lethil;
// module.exports.default = lethil;
