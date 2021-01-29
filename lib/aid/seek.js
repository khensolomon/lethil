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

/**
 * @param {string | url.URL | Buffer | fs.promises.FileHandle} file
 * * @param {fs.BaseEncodingOptions} options
 * @returns {Promise<any>}
 * util.promisify(fs.readFile)
 * fs.readFileSync(file)
 */
export function read(file,options={}){
  return fs.promises.readFile(file,options);
}

export const readSync = fs.readFileSync;
// export const readStream = fs.createReadStream;
/**
 * @param {string | url.URL | Buffer | fs.promises.FileHandle} file
 * @param {string | Uint8Array} raw
 * @param {fs.BaseEncodingOptions} options
 * @returns {Promise<void>}
 * util.promisify(fs.writeFile)
 * fs.writeFileSync(file, raw, options)
 */
export async function write(file,raw,options={}){
  return fs.promises.writeFile(file, raw, options);
}

export const writeSync = fs.writeFileSync;
// export const writeStream = fs.createWriteStream;


/**
 * @param {fs.PathLike} file
 * @param {(curr: fs.Stats, prev: fs.Stats) => void} listener
 */
export function watch(file,listener){
  return fs.watchFile(file, listener);
}
