import * as $ from "./config.js";
import aid from "../aid/index.js";

/**
 * @param {any} middleware
 * @param {any} req
 * @param {any} res
 */
export function filter(middleware, req, res={}) {
  return new Promise(
    resolve => middleware?middleware(req, res, () => resolve(true)):resolve(true)
  );
}

/**
 * @param {any} req
 * @return Promise<any>
 */
export function body(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("error", /** @param {any} err */function(err) {
      return reject(err);
    });
    req.on("data", /** @param {string} chunk */function(chunk) {
      body += "" + chunk;
    });
    req.on("end", () => resolve(body));
  });
}

/**
 * @param {any} req
 * @returns any
 */
export function middleware(req) {
  return $.route.middleware.filter(e=> req.pathname.startsWith(e.url+'/') == true);
}

/**
 * @param {any} req
 * @returns any
 */
export function route(req) {
  // NOTE: match direct

  var route = $.route.list.find(e=>e.url == req.pathname || aid.route.reg(e.url).test(req.url));
  if (route == undefined) {
    // NOTE: match params
    route = $.route.list.find(e=>e.url.includes(":") && aid.route.reg(e.url).test(req.url));
    if (route == undefined) {
      route = $.route.list.find(e=> e.url == '');
      if (route == undefined) {
        route = $.route.list.find(e => e);
      }
    }
  }

  $.route.menu.map(
    e => {
      e.parent = (e.url != '' && req.pathname.startsWith(e.url+'/') == true);
      e.active = e.url == route.url;
      return e;
    }
  );

  if (route){
    /**
     * @type {any} paramMatch
     * .replace(/((\?.*)[.?\=])/,'/$1') -> foo?id=val -> foo/?id=val
     */
    // const paramMatch = req.url.replace(/(\?.+[.?\=])/,'/$1').match(aid.parse.uri(route.url));
    const paramMatch = aid.route.match(req.url,route.url);
    if (paramMatch != undefined && paramMatch.groups) {
      Object.assign(req.params,paramMatch.groups)
    }

    const requestMethod = req.method.toLowerCase();
    const routeMethod = Object.keys(route.type);
    const availableMethod = routeMethod.includes(requestMethod)?requestMethod:routeMethod[0];
    return route.type[availableMethod];
  }
  return undefined;
}
