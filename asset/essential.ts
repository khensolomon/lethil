// declare global {}
// export namespace essential {}
// export default essential;
// export namespace configuration {
//   export let root:any;
//   export let port:any='3000';
//   export let app:string='app';
//   export let share:string='share';
//   export let main:string='index.js';
//   export let dir:any={};
// }
export namespace request {
  export const path:any = require('path');
  export const fs:any = require('fs-extra');
}
export namespace configuration {
  export let setting:any={
    port:3000,
    app:'app',
    share:'share',
    main:'index.js'
  };
  export let directory:any={};
}
export namespace utility {
  export const check:any={
    isObject:function(value:any){
      return value && typeof value === 'object' || value.constructor === Object;
    },
    isArray:function(value:any){
      return value && typeof value === 'object' || value.constructor === Array;
    },
    isFunction:function(value:any){
      return value && value instanceof Function;
    },
    isString:function(value:any){
      return value && typeof value === 'string' || value instanceof String;
    }
  };
  // check.isObject()
  // objects.merge()
  // arrays.merge()
  export const objects:any={
    merge:function(s:any, n:any){
      for (var p in n) {
         try {
           // Property in destination object set; update its value.
           if (check.isObject(n[p])) {
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
// export default request;
// export namespace configuration {
//   export const port:string='3000';
//   export const app:string='app';
//   export const share:string='share';
//   export const main:string='index.js';
// }

// export default essential;

// const path:any = require('path');
// const fs:any = require('fs-extra');
//
// const rootAssist:any={
//   isObject:function(value:any){
//     return value && typeof value === 'object' || value.constructor === Object;
//   },
//   isArray:function(value:any){
//     return value && typeof value === 'object' || value.constructor === Array;
//   }
// };
// const rootObject:any={
//   merge:function(s:any, n:any){
//     for (var p in n) {
//        try {
//          // Property in destination object set; update its value.
//          if (rootAssist.isObject(n[p])) {
//            s[p] = this.merge(s[p], n[p]);
//          } else {
//            s[p] = n[p];
//          }
//        } catch(e) {
//          // Property in destination object not set; create it and set its value.
//          s[p] = n[p];
//        }
//      }
//      return s;
//   }
// };
// const rootArray:any={
// };

// export {path,fs,rootConfiguration,rootAssist,rootObject,rootArray};
// rootConfiguration.merge=function(env){
//   Object.assign(this, env);
// }
// Object.defineProperty(rootConfiguration, 'merge', {
//   // writable:false, enumerable:false,
//   value:function(env){
//     if (env.hasOwnProperty('merge')) {
//       delete env.merge;
//     }
//     Object.assign(this, env);
//   }
// });
// class rootScore {
//   constructor() {
//     this.dir={};
//   }
//   merge(env){
//     if (env.hasOwnProperty('merge')) {
//       delete env.merge;
//     }
//     Object.assign(this, env);
//   }
// };
// module.exports = {path,fs,rootConfiguration,rootAssist,rootObject,rootArray};

