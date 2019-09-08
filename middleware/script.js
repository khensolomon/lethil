const url = require('url');
const path = require("path");
const fs = require('fs');
// const util = require('util');


var log ={
  msg:function(task, id, msg){
    console.log('[%s] \x1B[90m%s\x1B[0m \u001b[33;1m%s \u001b[32;1m%s\x1B[0m', 'evh', task, id, msg);
  }
}

module.exports = function(options){
  return (req, res, next)=>{
    var uri = url.parse(req.url).pathname;

    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    if (!/\.js$/.test(uri)) return next();

    if (options.prefix) {
      if (uri.indexOf(options.prefix) === 0) {
        uri = uri.substring(options.prefix.length);
      } else {
        log.msg('skip', uri, 'prefix mismatch');
        return next();
      }
    }

    var src = options.src || (function() {
      throw new Error('requires "src" directory.');
    }());
    var srcPath = path.join(src, uri);
    // var srcDir = path.dirname(srcPath);
    // var tarPath = path.join(options.dest, uri);

    if (fs.existsSync(srcPath)){
      res.writeHead(200, {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'max-age=10'
      });
      res.end(fs.readFileSync(srcPath));
      // res.end();
    } else {
      log.msg( 'skip', srcPath, 'not exist');
      next();
    }
  }
}
