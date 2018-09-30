export namespace request {
  export const path:any = require('path');
  export const fs:any = require('fs-extra');
  export let app:any ={};
}
export namespace configuration {
  export let setting:any={
    port:3000,
    name:'evh',
    main:'index.js',
    route:'route.js',
    score:'score.js',
    env:'.env',
    json:'scriptive.json',
    Ok:'serving',
    version:'1.0',
    listening:{}
  };
  export let directory:any={};

  // NOTE: styleMiddleWare
  export let style:any={
    // prefix: '/css',
    indentedSyntax: false,
    // debug: true,
    response:false,
    // NOTE: nested, expanded, compact, compressed
    outputStyle: 'compressed',
    sourceMap: false
  };
  // NOTE: scriptMiddleWare
  export let script:any={};
}
export namespace utility {
  export const log:any={
    msg:function(task:string, id:string, msg:string=''){
      console.log('[%s] \x1B[90m%s\x1B[0m \u001b[33;1m%s \u001b[32;1m%s\x1B[0m', configuration.setting.name, task, id, msg);
    }
  };
  export const check:any={
    isObject:function(value:any){
      return value && (typeof value === 'object' || value.constructor === Object);
    },
    isArray:function(value:any){
      return value && Array.isArray(value) || value instanceof Array;
    },
    isFunction:function(value:any){
      return value && typeof value === 'function' || value instanceof Function;
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
    },
    // routess,'id', true, false
    sort:function(o?:any, sortedBy:any=1, isNumericSort:boolean=false, reverse:boolean=false){
      // sortedBy = sortedBy || 1; // by default first key
      // isNumericSort = isNumericSort || false; // by default text sort
      // reverse = reverse || false; // by default no reverse

      var reversed = (reverse) ? -1 : 1;

      var sortable = [];
      for (var key in o) {
          if (o.hasOwnProperty(key)) {
              sortable.push([key, o[key]]);
          }
      }
      if (isNumericSort)
          sortable.sort(function (a, b) {
              return reversed * (a[1][sortedBy] - b[1][sortedBy]);
          });
      else
          sortable.sort(function (a, b) {
              var x = a[1][sortedBy].toLowerCase(),
                  y = b[1][sortedBy].toLowerCase();
              return x < y ? reversed * -1 : x > y ? reversed : 0;
          });
      return sortable; // array in format [ [ key1, val1 ], [ key2, val2 ], ... ]
    }
  };
  export const arrays:any={
  };
}
