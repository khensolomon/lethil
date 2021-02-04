import * as path from "path";
import * as $ from "./config.js";

/**
 * @param {any} menu
 * @param {() => void} fn
 * @param {any} method
 * @param {any} middleware
 */
function routeHandler(menu, fn, method, middleware=null) {

  const routeMethod = {callback:fn, middleware: middleware};
  const route = $.route.list.find(e=>e.url == menu.url);
  if (route) {
    route.type[method] = routeMethod;
  } else {
    $.route.menu.push(menu);
    $.route.list.push(
      {url:menu.url, type:{[method]: routeMethod}}
    );
    $.route.list.sort(
      (a, b) => b.url.localeCompare(a.url)
    );
  }

}

/**
 * join with slash
 * remove trailing slash
 * add slash at the end, needed for route menu->active
 * @param {...any} arg
 * @returns url
 */
function routeURI(...arg){
  return path.posix.join(arg.join('/')).replace(/\/+$/, '');
  // return path.posix.join(arg.join('/')).replace(/\/\/+$/, '/');
}

/**
 * @param {string} kind
 * @param {string} prefix
 * @param {any} uri
 * @returns {{url:string, text:string, group:string}}
 */
function routeObject(kind,prefix,uri){
  var response={ url:'', text:'', group:kind};
  if (typeof uri == 'object'){
    Object.assign(response,uri);
  } else {
    response.url=uri;
  }
  response.url=routeURI(prefix,response.url);
  return response;
}

/**
 * @param {string} method
 * @param {any} path
 * @param {any} rest
 */
function routeTerminal(method, path, rest) {
  if (rest.length === 1) {
    routeHandler(path, rest[0], method);
  } else {
    routeHandler(path, rest[1], method, rest[0]);
  }
}

export class Router {
  routeId = '';
  routePrefix = '/';

  /**
   * @todo ?
   * @ignore todo
   * @param {string} name
   * @param {...any} rest
   */
  set(name, ...rest){}

  /**
   * @todo ?
   * @ignore todo
   * @param {...any} rest
   */
  use(...rest){
    var name = '';
    var mwa = rest[0];
    if (rest.length > 1){
      name = rest[0];
      mwa = rest[1];
    }

    if (typeof mwa == 'function'){
      $.route.middleware.push({url:routeURI(this.routePrefix,name), callback:mwa});
    }
  }

  /**
   * @param {string | {url:string, text:string, group:string}} url
   * @param {...(req:any, res:any, next?:Function)=>void} rest
   */
  get(url, ...rest){
    routeTerminal('get',routeObject(this.routeId,this.routePrefix,url), rest);
  }

  /**
   * @param {string | {url:string, text:string, group:string}} url
   * @param {...(req:any, res:any, next?:Function)=>void} rest
   */
  post(url, ...rest){
    routeTerminal('post',routeObject(this.routeId,this.routePrefix,url), rest);
  }

  /**
   * @param {string | {url:string, text:string, group:string}} url
   * @param {...(req:any, res:any, next?:Function)=>void} rest
   */
  put(url, ...rest) {
    routeTerminal('put',routeObject(this.routeId,this.routePrefix,url), rest);
  }

  /**
   * @param {string | {url:string, text:string, group:string}} url
   * @param {...(req:any, res:any, next?:Function)=>void} rest
   */
  delete(url, ...rest) {
    routeTerminal('delete',routeObject(this.routeId,this.routePrefix,url), rest);
  }

}
