const config = require('../config');
const log = {
  msg:function(task, id, msg){
    console.log('[\x1b[34m%s\x1B[0m] \x1B[90m%s\x1B[0m\u001b[33;1m%s\u001b[32;1m%s\x1B[0m', config.name, task, id, msg);
  },
  listen:function(port, address){
    console.log('[\x1b[34m%s\x1B[0m] \x1B[90m%s\x1B[0m \u001b[33;1m%s\x1B[0m: \x1b[31m%s\x1B[0m', config.name, 'listen', port, address);
  },
  hostname:function(name, hosts){
    console.log('[\x1b[34m%s\x1B[0m] \x1B[90m%s\x1B[0m \u001b[33;1m%s\x1B[0m: \x1b[33m%s\x1B[0m', config.name, 'host', name, hosts.join('\x1b[0m, \x1b[33m'));
  },
  fail:function(id){
    console.log('[\x1b[34m%s\x1B[0m] \x1b[31m%s\x1B[0m -> \x1b[2m%s\x1b[0m', config.name, id.reason, id.message);
  }
};
const check = {
  isObject:function(value){
    return value && (typeof value === 'object' || value.constructor === Object);
  },
  isArray:function(value){
    return value && Array.isArray(value) || value instanceof Array;
  },
  isFunction:function(value){
    return value && typeof value === 'function' || value instanceof Function;
  },
  isString:function(value){
    return value && typeof value === 'string' || value instanceof String;
  },
  isNumeric:function(value){
    return /^-{0,1}\d+$/.test(value);
  }
};
const word = {
  explode:function(value){
    return value.trim().split(/\s+/);
  },
  count:function(value){
    return this.explode(value).length;
  }
};
const hack = {
  regex:function(e){
    var ASTERISK_REGEXP = /\*/g;
    var ASTERISK_REPLACE = '([^.]+)';
    var END_ANCHORED_REGEXP = /(?:^|[^\\])(?:\\\\)*\$$/;
    var ESCAPE_REGEXP = /([.+?^=!:${}()|[\]/\\])/g;
    var ESCAPE_REPLACE = '\\$1';

    var src = String(e).replace(ESCAPE_REGEXP, ESCAPE_REPLACE).replace(ASTERISK_REGEXP, ASTERISK_REPLACE);
    if (src[0] !== '^') {
      src = '^' + src
    }
    if (!END_ANCHORED_REGEXP.test(src)) {
      src += '$'
    }
    return new RegExp(src, 'i');
  },
  hostname:function(e){
    return /(?:[\w-]+\.)+[\w-]+/.exec(e)[0];
  }
};

const arrays={
  unique:function(a){
    // artist_newset:Array.from(new Set(row.listArtist.split(","))),
    // artist_dum:row.listArtist,
    // artist_filter:row.listArtist.split(",").filter(function (el) {
    //     return (el.hero === "Batman");
    // }),
    // artist_map:row.listArtist.split(",").map(function(e){return e.trim();}),
    // return Array.from(new Set(a.map((e:any)=>e.trim()).filter((item:any, pos:any, self:any) => {
    //     return self.indexOf(item) == pos && item!='';
    // })));
    return Array.from(new Set(a.map((e)=>e.trim()).filter((item, pos, self) => self.indexOf(item) == pos && item!='')));
  }
};

const objects={
  merge:function(s, n){
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
  },
  // routess,'id', true, false
  sort:function(o, sortedBy=1, isNumericSort=false, reverse=false){
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
    if (isNumericSort) {
      sortable.sort(function (a, b) {
        return reversed * (a[1][sortedBy] - b[1][sortedBy]);
      });
    } else {
      sortable.sort(function (a, b) {
        var x = a[1][sortedBy].toLowerCase(),
        y = b[1][sortedBy].toLowerCase();
        return x < y ? reversed * -1 : x > y ? reversed : 0;
      });
    }
    return sortable; // array in format [ [ key1, val1 ], [ key2, val2 ], ... ]
  },
  getKeybyValue:function(o, value, cse){
    for(var k in o){
      if (o.hasOwnProperty(k)) {
        if (cse) {
          if (o[k].match(new RegExp(value, cse))) return k;
        } else if (o[k] == value) {
          return k;
        }
      }
    }
    return false;
    // return Object.keys(o).find(k => o[k] === needle);
    // return Object.keys(o)[Object.values(o).indexOf(value)];
    // return Object.entries(o).find(key => key[1] === value);
  },
  getValuebyKey:function(o, value, cse){
    for(var k in o){
      if (o.hasOwnProperty(k)) {
        if (cse) {
          if (k.match(new RegExp(value, cse))) return o[k];
        } else if (k == value) {
          return o[k];
        }
      }
    }
    return false;
    // return Object.values(o)[Object.keys(o).indexOf(needle)];
    // return Object.values(o).find(key => o[key] === value);
    // return Object.keys(o).find(key => o[key] === value );
    // return Object.keys(o)[Object.values(o).indexOf(value)];
    // return Object.entries(o).find((key:[]) => key[0] === value);
  }
};

module.exports = {log, check, word, arrays, objects,hack};
