import * as http from "http";
import * as $ from "./config.js";
import aid from "../aid/index.js";

export const Server = http.Server;
export const IncomingMessage = http.IncomingMessage;
export const ServerResponse = http.ServerResponse;
/**
 * @typedef {Object} TypeOfCommandRequest
 * @property {string} method
 * @property {string} url
 * @property {string} pathname
 * @property {any} params
 * @property {any} query
 * @property {any} route
 *
 * @typedef {Request} TypeOfRouteRequest
 * property {ServerOptions<typeof Request, typeof ServerResponse>.IncomingMessage?: typeof Request | undefined}
 *
 * @typedef {Response} TypeOfRouteResponse
 * property {ServerOptions<typeof Request, typeof ServerResponse>.ServerResponse?: typeof http.ServerResponse | undefined}
 *
 * graphical user interface
 * @typedef {(req:TypeOfRouteRequest, res:TypeOfRouteResponse, next:()=>void)=>void} TypeOfRouteRestGui
 *
 * Middleware
 * @typedef {(req:TypeOfRouteRequest, res:TypeOfRouteResponse, next:()=>void)=>void} Middleware
 *
 * Middleware
 * typedef {(name:string, rest:Middleware)|Middleware} TypeOfRouteMiddle
 * typedef {Middleware} TypeOfRouteMiddle
 *
 * command line interface
 * typedef {()=>void} TypeOfRouteRestNone
 * @typedef {(req:TypeOfCommandRequest)=>void} TypeOfRouteRestCli
 * @type {TypeOfCommandRequest} req - see {@link TypeOfCommandRequest}
 *
 * property {ServerOptions<typeof Request, typeof ServerResponse>.IncomingMessage?: typeof Request | undefined}
 *
 * url
 * typedef {{url:string, text:string, group:string}} TypeRouteURL
 */
/**
 * @extends IncomingMessage
 */
class Request extends IncomingMessage {
  params = Object.create(null);
  route = {
    pathname: "",
    query: {},
  };

  // get route(){
  //   return aid.parse.url(this.url||'');
  // }
  get pathname() {
    return this.route.pathname;
  }
  /**
   * @returns {any}
   */
  get query() {
    return this.route.query;
  }
  get cookies() {
    return aid.parse.cookie(this.headers.cookie);
  }
}

/**
 * class Response extends ServerResponse {
 * class Response<Request extends IncomingMessage = IncomingMessage> extends ServerResponse<Request> {
 * @extends ServerResponse
 */
class Response extends ServerResponse {
  locals = Object.create(null);
  /**
   * @param {any} key
   * @param {any} val
   * @example res.setHeader("Content-Type", "application/json; charset=utf-8");
   * res.status({"audio/mpeg": "audio/mpeg", "Accept-Ranges": "bytes", "Content-Transfer-Encoding": "binary", "Pragma": "cache"});
   * res.setHeader('Set-Cookie', ['foo=bar', 'bar=foo']);
   */
  setHeaders(key, val = "") {
    if (typeof key == "string" && val) {
      this.setHeader(key, val);
    } else if (typeof key == "object") {
      for (let [k, v] of Object.entries(key)) this.setHeader(k, v);
    }
    return this;
  }

  /**
   * @param {any} key
   * @param {any} val
   * @example res.cookie("key", "value");
   * res.setHeader('Set-Cookie', ['foo=bar', 'bar=foo']);
   */
  cookies(key, val = "") {
    // Path=/;
    if (typeof key == "string") {
      this.setHeaders("Set-Cookie", [key, val].join("=") + "; Path=/");
    }
    return this;
  }

  /**
   * `Object.setPrototypeOf(res, Response.prototype)`
   * @example res.status(200).send('hello world');
   * @example res.status(404).send('Not found');
   * @fires `this.statusCode = status; res.end("Not found");`
   * @param {number} status
   */
  status(status) {
    this.statusCode = status;
    return this;
  }

  /**
   * @param {any} message
   * @example res.send('Goodbye');
   */
  send(message) {
    this.end(message);
  }

  /**
   * @param {object} data
   */
  json(data) {
    this.setHeader("Content-Type", "application/json; charset=utf-8");
    this.end(JSON.stringify(data));
  }

  /**
   * @param {string} filename - pug filename in `views` directory without ext.
   * param {[k: string]: any} data
   * @param {any} data - object
   * @example
   * render("home", { title: "Title", description: "Description", keywords: "lethil, web, framework", });
   */
  render(filename, data = {}) {
    // render('home', { title: 'Zaideih',description:'Zaideih Music Station',keywords:'zola, mp3, myanmar' });
    this.setHeader("Content-Type", "text/html; charset=utf-8");
    if ($.view.engine == null) {
      this.end("no template provided");
    } else {
      if (aid.seek.extname(filename).toLowerCase() != $.view.extension) {
        filename = filename + $.view.extension;
      }
      var file = aid.seek.resolve($.app.dir.root, $.app.dir.views, filename);
      var engine = $.view.engine.compileFile(file);
      this.end(engine(Object.assign({}, this.locals, data)));
    }
  }
}

/**
 * param {http.RequestListener} listener
 * @type {http.Server | undefined}
 */
var base;

/**
 * listener = () => null
 * @param {http.RequestListener} [listener] - requestListener
 * @returns {http.Server}
 */
export function refresh(listener) {
  // return (base = http.createServer(
  //   { IncomingMessage: Request, ServerResponse: Response },
  //   listener
  // ));
  return (base = http.createServer(
    // @ts-ignore
    { IncomingMessage: Request, ServerResponse: Response },
    listener
  ));
  // return (base = http.createServer(listener));
}

/**
 * listener = () => null
 * @param {http.RequestListener} [listener] - requestListener
 * @returns {http.Server}
 */
export function server(listener) {
  if (base == undefined) {
    return refresh(listener);
  } else {
    return base;
  }
}

// /**
//  * @param {Object} options
//  * @param {string} [options.name='']
//  * @param {string} [options.value='']
//  * @param {Date} [options.expires]
//  * @param {number} [options.maxAge]
//  * @param {string} [options.domain]
//  * @param {string} [options.path]
//  * @param {boolean} [options.secure]
//  * @param {boolean} [options.httpOnly]
//  * @param {'Strict'|'Lax'|'None'} [options.sameSite]
//  * @return {string}
//  */
// createSetCookie(options) {
//   return (`${options.name || ''}=${options.value || ''}`)
//     + (options.expires != null ? `; Expires=${options.expires.toUTCString()}` : '')
//     + (options.maxAge != null ? `; Max-Age=${options.maxAge}` : '')
//     + (options.domain != null ? `; Domain=${options.domain}` : '')
//     + (options.path != null ? `; Path=${options.path}` : '')
//     + (options.secure ? '; Secure' : '')
//     + (options.httpOnly ? '; HttpOnly' : '')
//     + (options.sameSite != null ? `; SameSite=${options.sameSite}` : '');
// }
