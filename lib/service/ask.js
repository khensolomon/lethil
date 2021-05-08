import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

/**
 * @param {any} urlOptions `{
    host: 'google.com',
    port: 80,
    path: '/',
    method: 'GET',
    headers: {
      'Content-Type': 'text/plain',
    }
  }`
 */
function getPrototype(urlOptions) {
  if (typeof urlOptions == 'string' && urlOptions.charAt(4).localeCompare('s') >= 0) {
    return https;
  } else if (typeof urlOptions == 'object' && urlOptions.port && urlOptions.port == 443) {
    // port: 443,
    return https;
  }
  return http;
};

/**
 * @callback askCallback
 * @param {http.IncomingMessage} res
 */
/**
 * @param {string | URL | https.RequestOptions} urlOptions
 * @param {askCallback} callback
 * @returns typeof https | typeof http
 */
function ask(urlOptions,callback) {
  return getPrototype(urlOptions).request(urlOptions, res =>  {
    // res.setEncoding('utf8');
    // res.statusCode == 302 res.statusCode > 300 && res.statusCode < 400 && res.headers.location
    if (res.statusCode && res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
      ask(res.headers.location,callback).end();
    } else {
      return callback(res);
    };
  });
};

/**
 * @param {any} urlOptions
 */
// export function request_(urlOptions) {
//   return new Promise((resolve, reject) => {
//     ask(urlOptions,resolve).on('error', reject).end();
//   });
// };

/**
 * @param {any} urlOptions
 * @param {any} postData
 */
 export function request(urlOptions,postData=null) {
  return new Promise((resolve, reject) => {
    const req = ask(urlOptions,
      res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(res.statusMessage);
          }
          try {
            if (urlOptions.headers && urlOptions.headers['Content-Type'].indexof('application/json') >= 0){
              resolve(JSON.parse(data));
            } else {
              resolve(data);
            }
          } catch (error) {
            reject(error.message);
          }
        });
      }
    );
    req.on('error', reject);
    if (postData != null){
      req.write(postData);
    }
    req.end();
  });
};

/**
 * @param {any} urlOptions
 * @param {string} filePath
 */
export function download_(urlOptions, filePath) {
  return new Promise((resolve, reject) => {
    if (urlOptions == '') reject('empty');
    var dirname = path.dirname(filePath);
    fs.promises.mkdir(dirname, { recursive: true }).catch(reject);
    const file = fs.createWriteStream(filePath);
    let fileInfo = {};

    const request = getPrototype(urlOptions).request(urlOptions, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get ${response.statusCode}`));
        return;
      }

      fileInfo = {
        mime: response.headers['content-type'],
        size: parseInt(response.headers['content-length']||'0', 10),
      };

      response.pipe(file);
    });

    // The destination stream is ended by the time it's called
    file.on('finish', () => resolve(fileInfo));

    request.on('error', err => fs.unlink(filePath, () => reject(err)));

    file.on('error', err => fs.unlink(filePath, () => reject(err)));

    request.end();
  });
}
