import * as api from "./api.js";
import * as $ from "./core.js";

export const db = $.db;
export const config = $.config.app;

export const init = $.prepareEnvironment;

export const route = api.route;
