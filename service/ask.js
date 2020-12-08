const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// const urlOptions = {
//   hostname: 'google.com',
//   port: 80,
//   path: '/',
//   method: 'GET',
//   headers: {
//      'Content-Type': 'text/plain',
//   }
// };

const getPrototype = function(urlOptions) {
  if (typeof urlOptions == 'string') {
    return !urlOptions.charAt(4).localeCompare('s') ? https : http;
  } else if (typeof urlOptions == 'object') {
    // port: 443,
    return (urlOptions.port && urlOptions.port == 443) ? https : http;
  } else {
    return http;
  }
};

const ask = function(urlOptions,callback) {
  return getPrototype(urlOptions).request(urlOptions, res =>  {
    // res.setEncoding('utf8');
    // res.statusCode == 302 res.statusCode > 300 && res.statusCode < 400 && res.headers.location
    if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
      return ask(res.headers.location,callback).end();
    } else {
      return callback(res);
    };
  });
};

exports.download =  async function(urlOptions, filePath) {
  return new Promise((resolve, reject) =>  {
    if (urlOptions == '') reject('empty');
    var dirname = path.dirname(filePath);
    fs.promises.mkdir(dirname, { recursive: true }).catch(reject);
    const file = fs.createWriteStream(filePath);
    let fileInfo = null;

    const request = getPrototype(urlOptions).request(urlOptions, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get ${response.statusCode}`));
        return;
      }

      fileInfo = {
        mime: response.headers['content-type'],
        size: parseInt(response.headers['content-length'], 10),
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

exports.request = function(urlOptions) {
  return new Promise((resolve, reject) => {
    ask(urlOptions,resolve).on('error', reject).end();
  });
};

exports.get = function(urlOptions) {
  return new Promise((resolve, reject) => {
    ask(urlOptions,(res) => {
      let data = '';
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject).end();
  });
};
