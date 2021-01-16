// @ts-check
import * as $ from "./config.js";
import aid from "../aid/index.js";
/**
 * @param {any} middleware
 * @param {any} req
 * @param {any} res
 */
export function filter(middleware, req, res) {
  if (!middleware) return new Promise(resolve => resolve(true));
  return new Promise(resolve => middleware(req, res, () => resolve(true)));
}

/**
 * @param {any} req
 * @return Promise<any>
 */
export function readBody(req) {
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
 * @param {any} request
 * @returns any
 */
export function routeActive(request) {
  const uri = aid.parse.url(request.url);

  request.pathname = uri.pathname||'';
  Object.assign(request.query,uri.query);

  // NOTE: match direct
  // var route = $.route.list.find(e=>e.path == requestURL || e.path == uri.pathname);
  var route = $.route.list.find(e=>e.path == uri.pathname || aid.parse.uri(e.path).test(request.url));
  if (route == undefined) {
    // NOTE: match params
    route = $.route.list.find(e=>e.path.includes(":") && aid.parse.uri(e.path).test(request.url));
    if (route == undefined) {
      route = $.route.list.find(e=> e.path == '');
      if (route == undefined) {
        route = $.route.list.find(e => e);
      }
    }
  }

  $.route.menu.map(
    e => {
      e.parent = (e.path != '' && request.pathname.startsWith(e.path+'/') == true);
      e.active = e.path == route.path;
      return e;
    }
  );

  if (route){
    /**
     * @type {any} paramMatch
     */
    const paramMatch = request.url.match(aid.parse.uri(route.path));
    if (paramMatch != undefined && paramMatch.groups) {
      Object.assign(request.params,paramMatch.groups)
    }

    const requestMethod = request.method.toLowerCase();
    const routeMethod = Object.keys(route.type);
    const availableMethod = routeMethod.includes(requestMethod)?requestMethod:routeMethod[0];
    return route.type[availableMethod];
  }
  return undefined;

}
// export function routeActive(requestURL,request) {
//   const uri = aid.parse.url(requestURL);

//   request.pathname = uri.pathname||'';
//   Object.assign(request.query,uri.query);

//   // NOTE: match direct
//   // var route = $.route.list.find(e=>e.path == requestURL || e.path == uri.pathname);
//   var route = $.route.list.find(e=>e.path == uri.pathname || aid.parse.uri(e.path).test(requestURL));
//   if (route == undefined) {
//     // NOTE: match params
//     route = $.route.list.find(e=>e.path.includes(":") && aid.parse.uri(e.path).test(requestURL));
//     if (route == undefined) {
//       route = $.route.list.find(e=> e.path == '');
//       if (route == undefined) {
//         route = $.route.list.find(e => e);
//       }
//     }
//   }

//   if (route){
//     /**
//      * @type {any} paramMatch
//      */
//     const paramMatch = requestURL.match(aid.parse.uri(route.path));
//     if (paramMatch != undefined && paramMatch.groups) {
//       Object.assign(request.params,paramMatch.groups)
//     }
//   }

//   $.route.menu.map(
//     e => {
//       e.parent = (e.path != '' && request.pathname.startsWith(e.path+'/') == true);
//       e.active = e.path == route.path;
//       return e;
//     }
//   );
//   // console.log('$.route.active',requestURL,$.route.menu.filter(e=>e.parent||e.active));
//   return route;
// }