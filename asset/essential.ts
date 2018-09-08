const path = require('path');
const fs = require('fs-extra');

const rootAssist:any={
  isObject:function(value:any){
    return value && typeof value === 'object' || value.constructor === Object;
  },
  isArray:function(value:any){
    return value && typeof value === 'object' || value.constructor === Array;
  }
};
const rootObject:any={
  merge:function(s:any, n:any){
    for (var p in n) {
       try {
         // Property in destination object set; update its value.
         if (rootAssist.isObject(n[p])) {
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
const rootArray:any={
};
const rootConfiguration:any={
  port:3000,
  app:'app',
  share:'share',
  main:'index.js',
  dir:{}
};


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

