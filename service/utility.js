const path = require("path");
// const config = require('../config');
// String
// var colorDefault ='\x1B[0m%s\x1b[0m';
var colorDim ='\x1B[90m%s\x1b[0m';
// Number
// var colorBlue ='\x1b[34m%s\x1B[0m';
var colorRed ='\x1b[31m%s\x1B[0m';
// Array
var colorBrown ='\x1b[33m%s\x1B[0m';
const log = {
  // listen:function(port, address){
  //   console.log('[\x1b[34m%s \x1B[90m%s \u001b[33;1m%s\x1B[0m: \x1b[31m%s\x1B[0m', config.name, 'listen', port, address);
  // },
  // hostname:function(name, hosts){
  //   console.log('[\x1b[34m%s\x1B[90m%s \u001b[33;1m%s\x1B[0m: \x1b[33m%s\x1B[0m', config.name, 'host', name, hosts.join('\x1b[0m, \x1b[33m'));
  // },
  // fail:function(e){
  //   console.log('\x1B[90m>\x1B[0m \x1b[31m%s\x1B[0m: \x1b[2m%s\x1B[0m', e.code, e.message);
  // },
  msg:function(e){
    // console.log(arguments.length)
    var arrayKey = colorDim.replace('%s\x1b[0m','>\x1b[0m %s')
    if (e){
      if (typeof e == 'object'){
        var msg = e.message;
        var code = e.code;
        if (code && msg){
          arrayKey +=': '+colorDim;
        }
        if (msg){
          if (msg.constructor === Number){
            msg = colorRed.replace('%s',msg)
          } else if (msg.constructor === Array){
            msg = msg.map(i=>colorBrown.replace('%s',i)).join(', ')
          }
        }
        console.log(arrayKey,code,msg)
      } else if (e.constructor == Array){
        console.log(arrayKey,e.join(', '))
      } else {
        console.log(arrayKey,e)
      }
    }
    // '> no: starter'
    // '> MyOrdbok: myordbok.*, www.myordbok.*'
    // '> host: MyOrdbok > myordbok.*, www.myordbok.*'
    // [evh] host MyOrdbok: myordbok.*, www.myordbok.*
    // [evh] host Zaideih: zaideih.*, www.zaideih.*, *
    // [evh] listen port: 80
  },

  error:function(e){
    if (e.message && e.code){
      this.msg({code:e.code,message:e.message.replace(e.code+':','').trim()});
    } else if (e.message && e.name){
      this.msg({code:e.name,message:e.message});
    } else if (e.message){
      this.msg({code:'?',message:e.message});
    } else {
      this.msg(e);
    }
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
  },

  env_format:function(e){
    return e.split(';').map(
      e => e.split(':')
    ).filter(
      e => e.length > 1
    );
  },
  env:function(e){
    return this.env_format(e).reduce(
      (o, i) => Object.assign(o,({[i[0]]: i[1]})), {}
    );
    // return e.split(';').map(
    //   e => e.split(':')
    // ).filter(
    //   e => e.length > 1
    // ).reduce(
    //   (o, i) => Object.assign(o,({[i[0]]: i[1]})), {}
    //   // (o, i) => {
    //   //   o[i[0]]= i[1];
    //   //   return o;
    //   // },{}
    // );
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
  },
  group:function(array, key,_is_remove){
    return array.reduce((result, currentValue) => {
      // If an array already present for key, push it to the array. Else create an array and push the object
      var test = Object.assign({},currentValue);
      if (_is_remove) {
        delete test[key];
        // var test = Object.keys(currentValue).filter(e=>e != key).reduce((o, item) => {
        //   return {...o, [item]: currentValue[item]}
        // }, {});
      }

      (result[currentValue[key]] = result[currentValue[key]] || []).push(test);
      // Return the current iteration `result` value, this will be taken as next iteration `result` value and accumulate
      return result;
    }, {}); // empty object is the initial value for result object
  },
  /*
  .category([{term:1},{term:2}], o => o.term)
  */
 category:function(array, keyGetter){
    const map = new Map();
    array.forEach(item => {
      var key = keyGetter(item), collection = map.get(key);
      if (!collection) {
        map.set(key, [item]);
      } else {
        collection.push(item);
      }
    });
    return map;
  }
};
/*
const __groupBy = (list, keyGetter) => {
  const map = new Map();
  list.forEach((item) => {
    var key = keyGetter(item), collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return map;
}
*/
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

function createUniqueId(structure){
  // return new Date().valueOf();
  // return Math.random().toString(36).substr(2, 9);
  var dt=new Date();
  var yy= dt.getFullYear().toString().substring(2);
  var mm = ("0" + dt.getMonth()).slice(-2);
  var uuid = dt.getTime();
  return (structure||'xxxx-yy-xx-mm-yxxxxxxxxx').replace('-yy-',yy).replace('-mm-',mm).replace(/[xy]/g, function(c) {
      var r = (uuid + Math.random()*16)%16 | 0;
      return (c=='x' ? r :(r&0x3|0x8)).toString(16);
  });
}
function packageAvailable(name){
  try {
    return require.resolve(path.resolve(process.mainModule.paths[0],name));
  } catch(e) {
    return null
  }
}
// moduleAvailable, moduleRequire
function packageRequire(name){
  var pkg = packageAvailable(name);
  if (pkg) return require(pkg);
}
/*
var start = timeCheck();
var end = timeCheck(start)
console.info('Execution time: %dms', end);
*/
function timeCheck(ended){
  var start = new Date();
  if (ended) {
    return start - ended;
  } else {
    return start;
  }
}
module.exports = {log, check, word, arrays, objects,hack, createUniqueId,packageAvailable,packageRequire,timeCheck};
