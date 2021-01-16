// @ts-nocheck

/**
 * @param {string} structure
 * @returns string
 */
export function createUniqueId(structure){
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

/**
 * var start = timeCheck();
 * var end = timeCheck(start)
 * console.info('Execution time: %dms', end);
 * @param {any/new Date()} ended
 * @returns number
 */
export function timeCheck(ended){
  const start = new Date();
  if (ended) {
    return start - ended;
  } else {
    return start;
  }
}
