// @ts-check

import * as fs from 'fs';
import * as seek from './seek.js';
import { environment } from './parse.js';

/**
 * read
 * @param {string[]} e
 * @returns Promise<{[k: string]: any}>
 */
export function file(...e) {
  try {
    return fs.readFileSync(seek.posix(e), 'utf8');
  } catch (error) {
    return '';
  }
}

/**
 * read and parse json
 * @param {string[]} e
 * @returns Promise<{[k: string]: any}>
 */
export function json(...e) {
  // var pkg = seek.exists(seek.posix(e));
  // return await fs.promises.readFile(pkg).then(e=>JSON.parse(e.toString())).catch(()=>({}));
  try {
    return JSON.parse(file(seek.posix(e)));
  } catch (error) {
    return {};
  }
}

/**
 * read and parse .env `env(string:filename)`.
 * @param {string[]} e
 * @returns Promise<any>
 */
export function env(...e) {
  // var pkg = seek.exists(seek.posix(e));
  // return await fs.promises.readFile(pkg).then(environment).catch(()=>({}));

  try {
    return environment(file(seek.posix(e)));
  } catch (error) {
    return {};
  }
}

/**
 * `module(dir,name)`
 * @param {string[]} e
 * @returns any
 */
export async function module(...e) {
  var a = seek.exists(seek.posix(e));
  if (a) {
    return await import(seek.file([a]));
  }
  return {};
}


/**
 * read
 * readJSON(string:filename)
 * @param {string[]} e
 * @returns Promise<{[k: string]: any}>
 */
// export function bundle(...e) {
//   var pkg = seek.posix(e);
//   try {
//     // console.log(pkg);
//     var abc = require(pkg);
//     // console.log('abc',abc);
//     return abc;
//   } catch (error) {
//     // console.log(error)
//     return null;
//   }
// }

/*
import {version} from './package.json';

const version = process.env.npm_package_version;

fs = require('fs')
json = JSON.parse(fs.readFileSync('package.json', 'utf8'))
version = json.version
*/