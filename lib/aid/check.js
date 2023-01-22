/**
 * Cross-Site Scripting (XSS) filter
 * Remove anything between `<` | `%3C` and `>` | `%3E` whichs suspicious xss.
 * Optionally, either `/` or `%2F`
 * @example
 * \r\n|\n|\r
 * <?>
 * <--?-->
 * javascript:/*-->
 * exp/*
 * @param {string} str
 * @returns {string} - if not empty, it's good to go
 */
export function isValid(str) {
  // NOTE: remove line breaks
  str = str.replace(/(\r\n|\n|\r)/gm, "");

  // NOTE: Simple validation: string
  // NOTE: tag <?>
  // return str.replace(/(\<)(.*?)(\>)/g, "");
  str = str.replace(/(\<|%3C)(.*)(\>|%3E)/g, "");

  // NOTE: tag <?< OR >?>
  str = str.replace(/(\<|%3C|\>|%3E)(.*)(\<|%3C\>|%3E)/g, "");

  // NOTE: comments <--?-->
  // str = str.replace(/(<--)(.*?)(-->)/g, "");

  // NOTE: XSS Locator javascript:/*-->
  str = str.replace(/(\/|%2F)(.*)(\>|%3E)/g, "");
  // str = str.replace(/:\/*-->/g, "");
  // str = str.replace(/(-->|<--)/g, "");

  // NOTE: with Expression exp/*
  str = str.replace(/(\/\*)/g, "");

  return str.replace(/\s+/g, " ").trim();
}

/**
 * Check for myanmar Text
 * @param {string} str
 * @example /[\u1000-\u109F]/.test(keyword)
 * @returns boolean
 */
export function isMyanmarText(str) {
  return /[\u1000-\u109F]/.test(str);
}

/**
 * @param {any} value
 * @returns boolean
 */
export function isObject(value) {
  return value && (typeof value === "object" || value.constructor === Object);
}

/**
 * @param {any} value
 * @returns boolean
 */
export function isArray(value) {
  return (value && Array.isArray(value)) || value instanceof Array;
}

/**
 * @param {any} value
 * @returns boolean
 */
export function isFunction(value) {
  return (value && typeof value === "function") || value instanceof Function;
}

/**
 * @param {any} value
 * @returns boolean
 */
export function isString(value) {
  return (value && typeof value === "string") || value instanceof String;
}

/**
 * @param {any} value
 * @returns boolean
 */
export function isNumber(value) {
  return /^-{0,1}\d+$/.test(value);
}
