const url = require('url');

import * as root from '../essential';
var rootRequest=root.request,
    rootUtility=root.utility,

    rootSetting=root.configuration.setting,
    rootDirectory=root.configuration.directory,

    rootObject=rootUtility.objects,
    rootArray=rootUtility.arrays,
    rootValidate=rootUtility.check;

export class middleware {
  constructor(option?:{}) {
  }
  get register(){
    return (req?:any, res?:any, next?:any)=>{
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }

      var path = url.parse(req.url).pathname;

      if (!/\.js$/.test(path)) {
        rootUtility.log.msg( 'skip', path, 'nothing to do from mine');
        return next();
      }
      next();
    }
  }
}