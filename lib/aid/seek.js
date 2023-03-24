import fs from "fs";
import path from "path";
import url from "url";
import readfileline from "readline";

/**
 * hack
 * join(string[])
 * @param {string[]} e
 * @returns string
 */
export const posix = (e) => e.join("/");

/**
 * @param  {...any} e
 */
export const file = (e) => url.pathToFileURL(posix(e)).href;

/**
 * @param  {...any} e
 */
export const dir = (e) => url.pathToFileURL(path.dirname(posix(e))).href;

/**
 * @example directory(dir); directory(dir,name);
 * @param {...string} e
 * @returns {string} file:///...
 */
export function directory(...e) {
  var a = path.resolve(posix(e));
  try {
    if (fs.statSync(a).isFile()) {
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
export function exists(...e) {
  var a = path.resolve(posix(e));
  return fs.existsSync(a) ? a : "";
}

/**
 * @param {string[]} e
 * @returns string
 */
export function resolve(...e) {
  return path.resolve(posix(e));
}

/**
 * create directory (recursively) if not exists. ensure directory existence
 * @param {string} file - directoryExistence
 * @param {Object<string,any>} options - { recursive: true }
 * @returns {boolean} - `true: already exists; false: just created`
 */
export function createDirectory(file, options = { recursive: true }) {
  var dir = path.dirname(file);
  if (fs.existsSync(dir)) {
    return true;
  }
  fs.mkdirSync(dir, options);
  return false;
}

/**
 * @param {string} e
 * @returns string
 */
export function extname(e) {
  return path.extname(e);
}

/**
 * @param {string | url.URL | Buffer | fs.promises.FileHandle} file
 * @param {fs.ObjectEncodingOptions} [options]
 * param {fs.BaseEncodingOptions} options
 * @returns {Promise<string | Buffer>}
 * @example
 * .read('file',{})
 * fs.promises.readFile('file',{})
 *
 * util.promisify(fs.readFile)
 * fs.readFileSync('file')
 */
export function read(file, options = {}) {
  return fs.promises.readFile(file, options);
}

export const readline = readfileline;
export const readSync = fs.readFileSync;
export const readStream = fs.createReadStream;

/**
 * @param {string | url.URL | Buffer | fs.promises.FileHandle} file
 * @param {string | Uint8Array} raw
 * @param {fs.ObjectEncodingOptions} [options]
 * param {fs.BaseEncodingOptions} options
 * @returns {Promise<void>}
 * @example
 * .write('file', content, {})
 *  fs.promises.writeFile('file', content, {})
 *
 * util.promisify(fs.writeFile)
 * fs.writeFileSync(file, raw, options)
 */
export async function write(file, raw, options) {
  createDirectory(file.toString());
  return fs.promises.writeFile(file, raw, options);

  // return fs.promises
  //   .mkdir(path.dirname(file.toString()), { recursive: true })
  //   .then(function (_e) {
  //     return fs.promises.writeFile(file, raw, options);
  //   })
  //   .catch((e) => e);
}

export const writeSync = fs.writeFileSync;
export const writeStream = fs.createWriteStream;

/**
 * Write JSON file
 * @param {string} file
 * @param {any[]|any} raw
 * @param {number} [space]
 * @returns {Promise<boolean>}
 */
export async function WriteJSON(file, raw, space = 0) {
  return await write(file, JSON.stringify(raw, null, space))
    .then(() => true)
    .catch(() => false);
}

/**
 * Read JSON file
 * @template T
 * @param {string} file
 * param {Array<any> | object} catchWith
 * returns {Promise<Array<any> | object>}
 * @param {T | []} [catchWith]
 * @returns {Promise<T>}
 */
export async function ReadJSON(file, catchWith = []) {
  return await read(file)
    .then((e) => JSON.parse(e.toString()))
    .catch(() => catchWith);
}

/**
 * @param {fs.PathLike} file
 * @param {(curr: fs.Stats, prev: fs.Stats) => void} listener
 */
export function watch(file, listener) {
  return fs.watchFile(file, listener);
}

export const statSync = fs.statSync;
