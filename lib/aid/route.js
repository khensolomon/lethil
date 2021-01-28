/**
 * @param {string} a
 * var opt_fn = (a) => `($|/(?<${a}>[^$/]+))?`;
 */
function opt_fn(a) {
  return '($|/a)?'.replace('a', a.replace(/\:(\w+)/g, '(?<$1>[^$/]+)'));
}

/**
 * @param {string} a
 * var req_fn = (a) => `/(?<${a}>[^$/]+)`;
 */
function req_fn(a) {
  return '/a'.replace('a', a.replace(/\:(\w+)/g, '(?<$1>[^$/]+)'));
}

/**
 * hack url and return RegExp `uri(string)`.
 * pathToRegex uri
 * @param {string} str
 * @param {string} modifier - default value ":"
 * @param {string} optional - default value "?"
 * @returns RegExp
 * @example
 * /foo /foo/ -> /^[\/]?foo[\/]?$/
 * /foo/id -> /^[\/]?foo\/id[\/]?$/
 * /foo/:id -> /^[\/]?foo\/([^\/]+)[\/]?$/
 * /foo/:id? -> /^[\/]?foo\/([^\/]+)?[\/]?$/
 * /foo/:id/:name -> /^[\/]?foo\/([^\/]+)\/([^\/]+)[\/]?$/
 * /foo/a/b -> /^[\/]?foo\/a\/b[\/]?$/
 * /foo-:id -> /^[/]?\/foo-(?<id>[^$/]+)[/]?$/
 */
export function reg(str,modifier=':',optional='?') {
  var result = '^[/]?';
  var opt = false;
  var arr = str.split('/').filter(e=>e);
  for (var i=0; i < arr.length; i++) {
    var e = arr[i];
    if (e.includes(modifier)){
      if (e.includes(optional)){
        result += opt_fn(e);
        opt=true;
      } else if (opt) {
        result += opt_fn(e);
      } else {
        result += req_fn(e);
      }
    } else {
      if (i > 0) result += '/';
      if (e.includes('?')){
        var a = e.split('?')[0];
        if (a) result += a;
      } else {
        result += e;
      }
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
 * reg(e.url).test(req.url)
 * @param {string} req
 * @param {string} res
 */
export function test(req,res){
  return reg(req).test(res);
}

/**
 * reg(e.url).test(req.url)
 * req.url.replace(/(\?.+[.?\=])/,'/$1').match(reg(route.url));
 * @param {string} req
 * @param {string} res
 * .replace(/((\?.*)[.?\=])/,'/$1') -> foo?id=val -> foo/?id=val
 * ((\?.*)[.?\=])
 * (\?.+[.?\=])
 */
export function match(req,res){
  return req.replace(/(\?.+[.?\=])/,'/$1').match(reg(res));
}
