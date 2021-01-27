import {IncomingMessage,ServerResponse,createServer,RequestListener,Server} from "http";
import * as $ from "./config.js";
import aid from "../aid/index.js";

/**
 * @extends IncomingMessage
 */
class Request extends IncomingMessage {
  params = Object.create(null);
  route = {
    pathname:'',
    query:{}
  };
  // get route(){
  //   return aid.parse.url(this.url||'');
  // }
  get pathname(){
    return this.route.pathname;
  }
  get query(){
    return this.route.query;
  }
  get cookies(){
    return aid.parse.cookie(this.headers.cookie);
  }

}

/**
 * @extends ServerResponse
 */
class Response extends ServerResponse{
  locals = Object.create(null);
  /**
   * @param {any} key
   * @param {any} val
   * @example res.set("Content-Type", "application/json; charset=utf-8");
   * @example res.status({"audio/mpeg": "audio/mpeg", "Accept-Ranges": "bytes", "Content-Transfer-Encoding": "binary", "Pragma": "cache"});
   */
  set(key,val='') {

    if (typeof key == 'string' && val){
      this.setHeader(key, val);
    } else if (typeof key == 'object'){
      for (let [k, v] of Object.entries(key)) this.setHeader(k, v);
    }
    return this;
  }

  /**
   * @param {any} key
   * @param {any} val
   * @example res.cookie("key", "value");
   */
  cookie(key,val='') {
    // this.setHeader('Set-Cookie', ['foo=bar', 'bar=foo']);
    // Path=/;
    // res.cookie('solId', Id);
    if (typeof key == 'string'){
      this.setHeader('Set-Cookie', [key,val].join('=')+'; Path=/');
    }
    return this;
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
  send(message){
    this.end(message);
  }

  /**
   * @param {object} data
   */
  json(data) {
    this.set("Content-Type", "application/json; charset=utf-8");
    this.end(JSON.stringify(data));
  }

  /**
   * @param {string} filename
   * param {[k: string]: any} data
   * @param {any} data
   */
  render(filename, data={}){
    // render('home', { title: 'Zaideih',description:'Zaideih Music Station',keywords:'zola, mp3, myanmar' });
    this.set("Content-Type", "text/html; charset=utf-8");
    if ($.view.engine == null) {
      this.end('no template provided');
    } else {
      if (aid.seek.extname(filename).toLowerCase() != $.view.extension){
        filename = filename+$.view.extension;
      }
      var file = aid.seek.resolve($.user.dir.root,$.user.dir.views,filename);
      var engine = $.view.engine.compileFile(file);
      this.end(engine(Object.assign(data,this.locals)));
    }
  }
}

/**
 * @param {RequestListener} listener
 * @type {Server | undefined}
 */
var base;

export function refresh(listener=()=>null){
  return base=createServer({IncomingMessage: Request,ServerResponse: Response},listener);
}

export function server(listener=()=>null){
  if (base == undefined){
    return refresh(listener);
  } else {
    return base;
  }
}
