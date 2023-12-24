/**
 * template R
 * @param {string[]} a - Array<any>
 * @param {boolean} [insensitive]
 * @returns {string[]}
 * @example
 * unique(['a','a','b']) -> ['a','b']
 * unique(['A','a']) -> ['A','a']
 * unique(['A','a'], true) -> ['A']
 */
export function unique(a, insensitive) {
  return Array.from(
    new Set(a.map((e) => (insensitive ? e.trim().toLowerCase() : e)))
  );
}

/**
 * @example
 * group([{a:1,b:2},{a:2,b:3}], "a")
 * @param {any[]} array
 * @param {any} key - name of the key to test
 * @param {boolean} _is_remove - remove the key
 */
export function group(array, key, _is_remove = false) {
  return array.reduce((result, currentValue) => {
    // If an array already present for key, push it to the array. Else create an array and push the object
    var test = Object.assign({}, currentValue);
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
}

/**
 * @template V,K
 * @param {V[]} array
 * @param {(e:V)=>K} keyGetter
 * returns {[K, V[]][]}
 * @returns {Map<K, V[]>}
 * @example category([{term:1},{term:2}], o => o.term)
 * Array.from(returnvalue);
 * [...returnvalue]
 * [...returnvalue].map(([key, value]) => ({ key, value, }));
 * Array.from(returnvalue, ([key, value]) => ({ [key]: value, }));
 */
export function category(array, keyGetter) {
  /**
   * @type {Map<K, V[]>}
   */
  const map = new Map();

  for (let index = 0; index < array.length; index++) {
    const item = array[index];
    var key = keyGetter(item),
      collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  }

  return map;
}
