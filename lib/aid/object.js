// @ts-check

import check from './check.js';

/**
 * @param {any} s
 * @param {any} n
 * @returns any[]
 */
export function merge(s, n){
  for (var p in n) {
     try {
       // Property in destination object set; update its value.
       if (check.object(n[p])) {
         s[p] = merge(s[p], n[p]);
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

/**
 * route, 1, true, false
 * @param {any} o
 * @param {number} sortedBy
 * @param {boolean} isNumericSort
 * @param {boolean} reverse
 * @returns any[]
 */
export function sort(o, sortedBy=1, isNumericSort=false, reverse=false){
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
}

/**
 * @param {any} o
 * @param {any} value
 * @param {any} cse
 * @returns any[] | boolen
 */
export function getKeybyValue(o, value, cse){
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
}

/**
 * @param {any} o
 * @param {any} value
 * @param {any} cse
 * @returns any[] | boolen
 */
export function getValuebyKey(o, value, cse){
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

export default {merge,sort,getKeybyValue,getValuebyKey};