import * as api from "./api.js";
import { fire } from "../aid/index.js";

/**
 * @param {api.CommandRequest} req
 * @returns {api.TypeOfList|undefined}
 */
export function route(req) {
  // NOTE: match direct

  const route = api.route.list.find(
    (e) => e.path == req.route.pathname || fire.route.pass(e.path).test(req.url)
  );

  if (route) {
    const paramMatch = fire.route.match(req.route.pathname, route.path);
    if (paramMatch != undefined && paramMatch.groups) {
      Object.assign(req.params, paramMatch.groups);
    }
  }
  return route;
}
