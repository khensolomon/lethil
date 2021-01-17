// @ts-check

class ParseURL extends URL {
  /**
   * @param {string} url
   * @param {string} base
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
 * hack url and return RegExp `uri(string)`.
 * pathToRegex uri
 * @param {string} str
 * @param {string} modifier
 * @param {string} optional
 * @returns RegExp
 * @example
 * /foo /foo/ -> `/^[\/]?foo[\/]?$/`,
 * /foo/id -> `/^[\/]?foo\/id[\/]?$/`,
 * /foo/:id -> `/^[\/]?foo\/([^\/]+)[\/]?$/`,
 * /foo/:id? -> `/^[\/]?foo\/([^\/]+)?[\/]?$/`,
 * /foo/:id/:name -> `/^[\/]?foo\/([^\/]+)\/([^\/]+)[\/]?$/`,
 * /foo/a/b -> `/^[\/]?foo\/a\/b[\/]?$/`
 */
export function uri(str,modifier=':',optional='?') {
  // let result = "";
  // for (var i=0; i < str.length; i++) {
  //   const c = str.charAt(i);
  //   if (c === ":") {
  //     // eat all characters
  //     let param = "";
  //     for (var j = i + 1; j < str.length; j++) {
  //       if (/\w/.test(str.charAt(j))) {
  //         param += str.charAt(j);
  //       } else {
  //         break;
  //       }
  //     }
  //     // result += `(?<${param}>\\w+)`;
  //     result += `(?<${param}>\\w+)`;
  //     i = j -1;
  //   } else {
  //     result += c;
  //   }
  // }
  // return new RegExp(result);
    // \/action(\/)(?<id>\w+)
    // /\/post\/(?<id>\w+)/
    // \/action(!?\/)?

    // \/action\/(?:(?<id>\w+)?)
    // \/action($|\/(?:(?<id>\w+)?))
    // ($|(\/(?:(?<id>\w+)))+)

    // \/action($|(?:\/(?<id>\w+)))
    // var result = str.split('/').map(
    //   e=>{
    //     if (e.includes(':')){
    //       var param = e.replace(':','');
    //       if (e.includes('?')){
    //         param = param.replace('?','')
    //         // return `/($|/(?<${param}>\\w+))`;
    //         return `/($|/(?<${param}>[^?/]+))`;
    //         // return `/($|/(?<${param}>[^?]+))`;
    //       } else {
    //         // return `(?<${param}>\\w+)`;
    //         // return `($|/(?<${param}>[^?/]+))`;
    //         return `(?<${param}>/)`;
    //       }
    //     } else {
    //       return e;
    //       // return '([^/]+)?[/]?';
    //     }
    //   }
    // ).join('/').replace(/\/\//,'');
    // return new RegExp(result);

  /**
   * @param {*} a
   */
  var opt_fn = (a) => `($|/(?<${a}>[^$/]+))?`;
  /**
   * @param {*} a
   */
  var req_fn = (a) => `/(?<${a}>[^$/]+)`;

  var result = '^[/]?';
  var opt = false;
  var arr = str.split('/').filter(e=>e);
  for (var i=0; i < arr.length; i++) {
    var e = arr[i];
    if (e.includes(modifier)){
      e = e.replace(modifier,'');
      if (e.includes(optional)){
        e = e.replace(optional,'');
        // result += `($|/(?<${e}>[^$/]+))?`;
        result += opt_fn(e);
        opt=true;
      } else if (opt) {
        result += opt_fn(e);
      } else {
        result += req_fn(e);
      }
    } else {
      if (i > 0) result += '/';
      result += e;
    }
  }
  if(opt) {
    result += '.*';
  } else {
    result += '[/]?$';
  }
  return new RegExp(result);
}

/**
 * parse command to url.
 * @param {string[]} str
 * @returns string
 */
export function cli(str) {
  var requestURL = str.join('--');

  if (requestURL && /^\//.test(requestURL) == false){
    requestURL = '/'+requestURL;
    // /^\//.test(requestURL)
  }

  if (str.length > 1 && requestURL.includes('?') == false) {
    requestURL = requestURL.replace(/--/,'?');
  }

  // NOTE: param/id?a=1 b=2 -> param/id?a=1&b=2
  // NOTE: param/id?a=1--b=2 -> param/id?a=1&b=2
  // NOTE: param/id a=1 b=2 -> param/id?a=1&b=2
  // NOTE: param/id a:1 b:2 -> param/id?a=1&b=2
  return requestURL.replace(/--/g,'&').replace(/:/g,'=');
}

/**
 * hostNameRegex(http://locahost:8081) -> /^http\:\/\/locahost\:8081$/i
 * localhost.local -> /^localhost\.local$/i
 * http://*.locahost.local -> /^http\:\/\/([^.]+)\.localhost\.local$/i
 * @param {string} e
 * @returns RegExp
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
 * hostNameExec(*.example.com) -> example.com
 * http://www.*.example.com -> example.com
 * @param {string} e
 * @returns any
 */
export function hostNameExec(e){
  // return /(?:[\w-]+\.)+[\w-]+/.exec(e);
  return /(?:[\w-]+\.)+[\w-]+/.exec(e)?.[0];
}

/**
 *
 * @param {String|Buffer} str
 * {[k: string]: any} result
 * @returns {any}
 */
export function environment(str) {
  /**
   * @type {any} result
   */
  var result = {};
  if (Buffer.isBuffer(str)) str = str.toString();
  var e = str.replace(/\r\n/g,'\n').split('\n').filter(e=>/^[#;]/.test(e) == false && /=/.test(e));
  for (var i=0; i < e.length; i++) {
    if (e[i]) {
      var j = e[i].split(/=(.*)/g).map(e=>e.trim());
      if (j.length > 1) result[j[0]]=j[1];
    }
  }
  return result;
}

/**
 * envFormat('a:1;b:2;c:3') -> {a:1,b:2,c:3}
 * @param {String} e
 * @returns Object
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
 * explode('one two') -> [one,two]
 * @param {any} value
 * @returns any[]
 */
export function explode(value) {
  return value.trim().split(/\s+/);
}

/**
 * count('one two') -> 2
 * @param {any} value
 * @returns number
 */
export function count(value) {
  return explode(value).length;
}

export default {uri,url,cli,hostNameRegex,hostNameExec,environment,context, explode, count};