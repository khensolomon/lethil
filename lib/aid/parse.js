import {uri} from './path-to-regex.js';

/**
 * @extends {URL}
 */
class ParseURL extends URL {
  /**
   * by providing custom base param, expected a valid url
   * @param {string} url
   * @param {string} base - is optional, default "path://local"
   */
  constructor(url, base="path://local") {
    super(url, base);
  }

  get query(){
    // return [...new URLSearchParams(this.search).entries()].reduce((prev, [key,val]) => {prev[key] = val; return prev}, {});
    return Object.fromEntries(this.searchParams);
  }
}

/**
 * parse URL and return params as object `query(string)`.
 * @param {string} str
 * @returns any
 */
export function url(str) {
  return new ParseURL(str);
}

/**
 * parse command to url.
 * @param {string[]} str
 * @returns string
 * NOTE: param/id?a=1 b=2 -> param/id?a=1&b=2
 * NOTE: param/id?a=1--b=2 -> param/id?a=1&b=2
 * NOTE: param/id a=1 b=2 -> param/id?a=1&b=2
 * NOTE: param/id a:1 b:2 -> param/id?a=1&b=2
 */
export function cli(str) {
  var requestURL = str.join('--');

  if (requestURL && /^\//.test(requestURL) == false){
    requestURL = '/'+requestURL;
  }

  if (str.length > 1 && requestURL.includes('?') == false) {
    requestURL = requestURL.replace(/--/,'?');
  }
  return requestURL.replace(/--/g,'&').replace(/:/g,'=');
}

/**
 * @param {string} e
 * @returns RegExp
 * @example
 * hostNameRegex("http://locahost:8081") -> /^http\:\/\/locahost\:8081$/i
 * hostNameRegex("localhost.local") -> /^localhost\.local$/i
 * hostNameRegex("http://*.locahost.local") -> /^http\:\/\/([^.]+)\.localhost\.local$/i
 */
export function hostNameRegex(e) {
  var ASTERISK_REGEXP = /\*/g;
  var ASTERISK_REPLACE = '([^.]+)';
  var END_ANCHORED_REGEXP = /(?:^|[^\\])(?:\\\\)*\$$/;
  var ESCAPE_REGEXP = /([.+?^=!:${}()|[\]/\\])/g;
  var ESCAPE_REPLACE = '\\$1';

  var src = String(e).replace(ESCAPE_REGEXP, ESCAPE_REPLACE).replace(ASTERISK_REGEXP, ASTERISK_REPLACE);
  if (src[0] !== '^') src = '^' + src;
  if (!END_ANCHORED_REGEXP.test(src))  src += '$';

  return new RegExp(src, 'i');
}

/**
 * @param {string} e
 * @returns any
 * @example
 * hostNameExec(*.example.com) -> example.com
 * hostNameExec(http://www.*.example.com -> example.com
 */
export function hostNameExec(e){
  // return /(?:[\w-]+\.)+[\w-]+/.exec(e);
  return /(?:[\w-]+\.)+[\w-]+/.exec(e)?.[0];
}

class environmentParser{
  /**
   * @private
   */
  val = '';

  /**
   * @param {*} val
   */
  constructor(val){
    this.val = val
  }

  /**
   * @example restrict("d1v:l1;i1o:i1;a1n:a1;w1b:w1") -> {d1v:"l1",i1o:"i1",a1n:"a1",w1b:"w1"}
   */
  restrict(){
    return context(this.val);
  }

  /**
   * @example listen("host:localhost;port:8082") -> {host:"localhost",port:8082}
   */
  listen(){
    return context(this.val);
  }

  /**
   * Remove duplicate
   * @example referer("locahost.local;example.com;example.com") -> [/^localhost\.local$/i,/^example\.com$/i]
   */
  referer(){
    // return aid.fire.array.unique($.user.referer.split(';')).map(aid.parse.hostNameRegex);
    return this.val.split(';').filter((value, index, self)=>self.indexOf(value) === index).map(hostNameRegex);
  }
}

/**
 * @param {String|Buffer} str
 * @returns {any}
 *  {{[k: any]: any}}
 */
export function environment(str) {
  /**
   * @type {any} result
   */
  var result = {};
  // const parser = new environmentParser();
  if (Buffer.isBuffer(str)) str = str.toString();
  var e = str.replace(/\r\n/g,'\n').split('\n').filter(e=>/^[#;]/.test(e) == false && /=/.test(e));
  for (var i=0; i < e.length; i++) {
    if (e[i]) {
      /** @type {any} j */
      var j = e[i].split(/=(.*)/g).map(e=>e.trim());
      if (j.length > 1) {
        const parser = new environmentParser(j[1]);
        /** @type {keyof parser} name */
        const name = j[0];
        if (name in parser && typeof parser[name] == 'function'){
          result[j[0]]=parser[name]();
        } else {
          result[j[0]]=j[1];
        }
      }
    }
  }
  return result;
}

/**
 * @param {String} e
 * @returns Object
 * @example context('a:1;b:2;c:3') -> {a:1,b:2,c:3}
 */
export function context(e) {
  return e.split(';').map(
    e => e.split(':')
  ).filter(
    e => e.length > 1
  ).reduce(
    (o, i) => Object.assign(o,({[i[0]]: i[1]})), {}
  );
}

/**
 * @param {any} value
 * @returns any[]
 * @example explode('one two') -> [one,two]
 */
export function explode(value) {
  return value.trim().split(/\s+/);
}

/**
 * @param {any} value
 * @returns number
 * @example count('one two') -> 2
 */
export function count(value) {
  return explode(value).length;
}

/**
 * cookie Parser -> this.headers.cookie
 * @param {any} str
 * @example cookier('foo=bar; bar=foo') -> {foo:bar, bar:foo}
 */
export function cookie(str){
  if (typeof str == "string"){
    return str.split(';').filter(
      e => e
    ).map(
      x => x.split('=')
    ).reduce(
      (accum,current) => {
        // @ts-ignore
        accum[current[0]] = decodeURIComponent(current[1]);
        return accum;
      }, {}
    );
  }
  return {};
}

/**
 * cookie Stringify -> this.headers.cookie
 * @param {any} o - of an Object
 * @example cookieStringify({a:1, b:4}) -> "a=1; b=4"
 */
export function cookieStringify(o){
  return Object.entries(o).map(
    ([k,v]) => k + '=' + encodeURIComponent(v)
  ).join('; ');
}

export default {uri,url,cli,hostNameRegex,hostNameExec,environment,context, explode, count,cookie};