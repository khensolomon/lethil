'use strict';
// @ts-check

import aid from "./aid/index.js";

import service from "./service/index.js";
import * as $ from "./framework/index.js";
import gui from "./gui.js";
import cli from "./cli.js";

/**
 * @param {keyof typeof $.init} name
 * @param {any} val
 */
export function set(name,val){
  if (arguments.length == 2) {
    if (name in $.init) $.init[name](val);
  }
}

export const db = $.db;
export const config = $.config.user;

/**
 * @param {string} routeId
 * @param {string} routePrefix
 */
export const route = (routeId='',routePrefix='') => new $.Route(routeId,routePrefix);

export const server = gui;
export const command = cli;

export const check = aid.check;
export const load = aid.load;
export const parse = aid.parse;
export const seek = aid.seek;
export const fire = aid.fire;

export const utility = service.utility;
export const ask = service.ask;
export const timer = service.timer;
export const burglish = service.burglish;

// export const environment = $.config.environment;

const lethil = {
  set, db, config, route, command, server,
  check, load, parse, seek, fire,
  utility, ask, timer, burglish
};
/** @namespace */
export default lethil;