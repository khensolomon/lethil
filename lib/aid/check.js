export default {
  /**
   * @param {any} value
   * @returns boolean
   */
  object(value) {
    return value && (typeof value === 'object' || value.constructor === Object);
  },

  /**
   * ?
   * @param {any} value
   * @returns boolean
   */
  array(value) {
    return value && Array.isArray(value) || value instanceof Array;
  },

  /**
   * ?
   * @param {any} value
   * @returns boolean
   */
  function(value) {
    return value && typeof value === 'function' || value instanceof Function;
  },

  /**
   * ?
   * @param {any} value
   * @returns boolean
   */
  string(value) {
    return value && typeof value === 'string' || value instanceof String;
  },

  /**
   * ?
   * @param {any} value
   * @returns boolean
   */
  number(value) {
    return /^-{0,1}\d+$/.test(value);
  }
}