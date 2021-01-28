/**
 * arrayUnique(['a','a','b']) to ['a','b']
 * @param {Array<any>} a
 * @returns Array<any>
 */
export function unique(a){
  return Array.from(new Set(a.map(
    (e)=> (typeof e == 'string')?e.trim():e
  ).filter(
    (item, pos, self) => self.indexOf(item) == pos && item!=''
    )
  ));
}

/**
 * ?
 * @param {any[]} array
 * @param {any} key
 * @param {boolean} _is_remove
 */
export function group(array, key,_is_remove=false){
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
}

/**
 * @param {any[]} array
 * @param {(e:any)=>any} keyGetter
 * @example category([{term:1},{term:2}], o => o.term)
 */
export function category(array, keyGetter){
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

export default {unique,group,category};