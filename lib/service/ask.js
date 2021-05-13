import * as http from 'http';
import * as https from 'https';
// import * as fs from 'fs';
// import * as path from 'path';

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
 * @example await ask.stream('urlOption').then(e => e.pipe(fs.createWriteStream('/tmp/test.json')));
 */
export function stream(urlOptions) {
  return new Promise((resolve, reject) => {
    ask(urlOptions,resolve).on('error', reject).end();
  });
};

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
            if (urlOptions.headers && urlOptions.headers['Content-Type'].indexOf('application/json') >= 0){
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

// /**
//  * @param {any} urlOptions
//  * @param {string} filePath
//  */
// function download_(urlOptions, filePath) {
//   return new Promise((resolve, reject) => {
//     if (urlOptions == '') reject('empty');
//     var dirname = path.dirname(filePath);
//     fs.promises.mkdir(dirname, { recursive: true }).catch(reject);
//     const file = fs.createWriteStream(filePath);
//     let fileInfo = {};

//     const request = getPrototype(urlOptions).request(urlOptions, response => {
//       if (response.statusCode !== 200) {
//         reject(new Error(`Failed to get ${response.statusCode}`));
//         return;
//       }

//       fileInfo = {
//         mime: response.headers['content-type'],
//         size: parseInt(response.headers['content-length']||'0', 10),
//       };

//       response.pipe(file);
//     });

//     // The destination stream is ended by the time it's called
//     file.on('finish', () => resolve(fileInfo));

//     request.on('error', err => fs.unlink(filePath, () => reject(err)));

//     file.on('error', err => fs.unlink(filePath, () => reject(err)));

//     request.end();
//   });
// }

export class gistData{
  /**
   * setting type definition
   * @typedef {Object} Setting
   * @property {String} token - gist token is required
   * @property {String} id - gist id is required
   * @property {String} [type] - Content-Type is optional 'application/json'
   * @property {Object} [options] - url-Options is optional
   */
  /**
   * @param {Setting} setting
   */
  constructor(setting){
    this.setting = setting;
    this.options = {
      host: 'api.github.com',
      port: 443,
      path: `/gists/${setting.id}`,
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${setting.token}`,
        'Content-Type': setting.type||'application/json',
        'User-Agent': 'Node.js'
      }
    };
    if (setting.hasOwnProperty('options')) {
      Object.assign(this.options, setting.options);
    }
  }

  /**
   * @param {any} [options]
   */
  async request(options) {
    const opt = (options)?{...this.options, ...options}:this.options;
    return request(opt);
  }

  /**
   * @param {String} fileName
   * @param {any} [options]
   */
  async get(fileName='', options) {
    try {
      const res = await this.request(options).catch(
        e=> {
          throw e
        }
      );
      const file = fileName ? res.files[fileName] : res;
      if (file && file.hasOwnProperty('type')){
        if (file.type == this.options.headers['Content-Type']) {
          return JSON.parse(file.content)
        }
        return file.content
      }
      return file;
    } catch (error) {
      throw new Error(error)
    }
  }

  /**
   * @param {String} fileName
   * @param {any} fileContent
   */
  patch(fileName, fileContent){
    return request({...this.options, ...{method:'PATCH'}},
      JSON.stringify({
        files:{
          [fileName]:{
            content:fileContent
          }
        }
      })
    );
  }

  /**
   * todo
   * @param {String} fileName
   */
   async delete(fileName) {
    return await request({...this.options, ...{method:'PATCH'}},
      JSON.stringify({
        files:{
          [fileName]:{
            content:""
          }
        }
      })
    );
  };

  /**
   * todo
   * @returns null
   */
  comments(){
    return null;
  }
}