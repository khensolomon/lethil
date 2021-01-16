'use strict';
// @ts-check

import * as aid from "./aid/index.js";
import service from "./service/index.js";
import * as $ from "./framework/index.js";
import server from "./gui.js";
import command from "./cli.js";

export const utility = service.utility;
export const ask = service.ask;
export const timer = service.timer;
export const burglish = service.burglish;
export const check = aid.check;
export const load = aid.load;
export const parse = aid.parse;
export const fire = aid.default;
// export const environment = $.config.environment;
// export const db = $.db;
// export const config = $.config;
// export const init = $.init;

/**
 * @param {keyof typeof $.init} name
 * @param {any} val
 */
export function set(name,val){
  if (arguments.length == 2) {
    if (name in $.init) $.init[name](val);
  }
}

export const db = () => $.db;
export const config = () => $.config.user;

/**
 * @param {string} routeId
 * @param {string} routePrefix
 * export function route(routeId,routePrefix){ return new $.Route(routeId,routePrefix); }
 */
export const route = (routeId,routePrefix) => new $.Route(routeId,routePrefix);

export default { set, db, config, route, command, server};

/*
set, route, db
Command, Server,
*/