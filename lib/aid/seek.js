// @ts-check

import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

/**
 * hack
 * join(string[])
 * @param {string[]} e
 * @returns string
 */
export const posix = e => e.join('/');

/**
 * @param  {...any} e
 */
export const file = e => url.pathToFileURL(posix(e)).href;

/**
 * @param  {...any} e
 */
export const dir = e => url.pathToFileURL(path.dirname(posix(e))).href;

/**
 * @example directory(dir); directory(dir,name);
 * @param {...string} e
 * @returns string file:///...
 */
export function directory(...e){
  var a = path.resolve(posix(e));
  try {
    if (fs.statSync(a).isFile()){
      return path.dirname(a);
    } else {
      return a;
    }
  } catch (error) {
    return path.dirname(a);
  }

}

/**
 * @example exists(dir); exists(dir,name);
 * @param {string[]} e
 * @returns string
 */
export function exists(...e){
  var a = path.resolve(posix(e));
  return fs.existsSync(a)?a:'';
}

/**
 * @param {string[]} e
 * @returns string
 */
export function resolve(...e){
  return path.resolve(posix(e));
}
/**
 * @param {string} e
 * @returns string
 */
export function extname(e){
  return path.extname(e);
}
