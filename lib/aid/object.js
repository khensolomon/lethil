import * as check from "./check.js";

/**
 * @template T,S - Merge object target and source
 * @param {T} t - Target
 * @param {S} s - Source
 * @returns {T & S}
 */
export function merge(t, s) {
  if (check.isObject(s)) {
    for (var p in s) {
      try {
        // Property in destination object set; update its value.
        if (check.isObject(s[p])) {
          // @ts-ignore
          t[p] = merge(t[p], s[p]);
        } else {
          // @ts-ignore
          t[p] = s[p];
        }
      } catch (e) {
        // Property in destination object not set; create it and set its value.
        // @ts-ignore
        t[p] = s[p];
      }
    }
  }
  // @ts-ignore
  return t;
}

/**
 * route, 1, true, false
 * @param {any} o
 * @param {number} sortedBy
 * @param {boolean} isNumericSort
 * @param {boolean} reverse
 * @returns any[]
 */
export function sort(o, sortedBy = 1, isNumericSort = false, reverse = false) {
  // sortedBy = sortedBy || 1; // by default first key
  // isNumericSort = isNumericSort || false; // by default text sort
  // reverse = reverse || false; // by default no reverse
  var reversed = reverse ? -1 : 1;
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

// /**
//  * @param {any} o
//  * @param {string | RegExp} value
//  * @param {string} [flags]
//  * @returns any[] | boolen
//  */
// export function getKeybyValue(o, value, flags) {
//   for (var k in o) {
//     if (o.hasOwnProperty(k)) {
//       if (flags) {
//         if (o[k].match(new RegExp(value, flags))) return k;
//       } else if (o[k] == value) {
//         return k;
//       }
//     }
//   }
//   return false;
//   // return Object.keys(o).find(k => o[k] === needle);
//   // return Object.keys(o)[Object.values(o).indexOf(value)];
//   // return Object.entries(o).find(key => key[1] === value);
// }

// /**
//  * @param {any} o
//  * @param {string | RegExp} value
//  * @param {string} [flags]
//  * @returns any[] | boolen
//  */
// export function getValuebyKey(o, value, flags) {
//   for (var k in o) {
//     if (o.hasOwnProperty(k)) {
//       if (flags) {
//         if (k.match(new RegExp(value, flags))) return o[k];
//       } else if (k == value) {
//         return o[k];
//       }
//     }
//   }
//   return false;
//   // return Object.values(o)[Object.keys(o).indexOf(needle)];
//   // return Object.values(o).find(key => o[key] === value);
//   // return Object.keys(o).find(key => o[key] === value );
//   // return Object.keys(o)[Object.values(o).indexOf(value)];
//   // return Object.entries(o).find((key:[]) => key[0] === value);
// }
