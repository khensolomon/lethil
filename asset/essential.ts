export namespace request {
  export const path:any = require('path');
  export const fs:any = require('fs-extra');
}
export namespace configuration {
  export let setting:any={
    port:3000,
    app:'app',
    share:'share',
    main:'index.js',
    env:'.env',
    json:'scriptive.json',
    Ok:'[app]',
    version:'1.0',
    listening:{}
  };
  export let directory:any={};
}
export namespace utility {
  export const check:any={
    isObject:function(value:any){
      return value && typeof value === 'object' || value.constructor === Object;
    },
    isArray:function(value:any){
      return value && Array.isArray(value) || value instanceof Array;
    },
    isFunction:function(value:any){
      return value && value instanceof Function;
    },
    isString:function(value:any){
      return value && typeof value === 'string' || value instanceof String;
    }
  };
  export const objects:any={
    merge:function(s:any, n:any){
      for (var p in n) {
         try {
           // Property in destination object set; update its value.
           if (utility.check.isObject(n[p])) {
             s[p] = this.merge(s[p], n[p]);
           } else {
             s[p] = n[p];
           }
         } catch(e) {
           // Property in destination object not set; create it and set its value.
           s[p] = n[p];
         }
       }
       return s;
    }
  };
  export const arrays:any={
  };
}
