var url = require('url'),
    util = require('util');

import * as root from '../service/';
var rootRequest=root.request,
    rootUtility=root.utility,

    rootSetting=root.configuration.setting,
    rootDirectory=root.configuration.directory,

    rootObject=rootUtility.objects,
    rootArray=rootUtility.arrays,
    rootValidate=rootUtility.check;

export interface middlewareOptions{
  prefix:string;
  maxAge?:number;
  // '/css',
  indentedSyntax?: false;
  // indentedSyntax?: boolean;
  // indentedSyntax: false,
  // debug: true,
  response:boolean;
  // response:false,
  // NOTE: nested, expanded, compact, compressed
  // outputStyle: 'compressed',
  outputStyle: string;
  // sourceMap: boolean;
  // sourceMap: false
  src: string;
  dest: string;
}
export const middleware = function(options?:middlewareOptions){
  return (req?:any, res?:any, next?:any)=>{
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    var path = url.parse(req.url).pathname;

    if (!/\.js$/.test(path)) {
      rootUtility.log.msg( 'skip', path, 'nothing to do from mine');
      return next();
    }
    // options.hasOwnProperty('prefix')
    if (options.prefix) {
      if (path.indexOf(options.prefix) === 0) {
        path = path.substring(options.prefix.length);
      } else {
        rootUtility.log.msg('skip', path, 'prefix mismatch');
        return next();
      }
    }
    // next();
    if (/\.js$/.test(path)) {
      rootUtility.log.msg( 'thats', path, 'to compile');
    } else {
      return next();
    }
    var src = options.src || (function() {
      throw new Error('requires "src" directory.');
    }());
    var tarPath = rootRequest.path.join(options.dest, path),
        srcPath = rootRequest.path.join(src, path),
        srcDir = rootRequest.path.dirname(srcPath);

        // console.log(tarPath,srcPath,srcDir);

    // Compile to cssPath
    var compile = function() {
      rootRequest.fs.pathExists(srcPath, function(err:any, exists:any) {
        if (!exists) {
          rootUtility.log.msg( 'skip', srcPath, 'does not exist');
          return next();
        }
        res.writeHead(200, {
          'Content-Type': 'application/javascript',
          'Cache-Control': 'max-age=0'
        });
        res.end('console.log(120);');
      });
    };
    compile();
  }
}