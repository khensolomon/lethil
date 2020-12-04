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

// requestGet, requestPost request
const request = function(urlOptions) {
  return new Promise((resolve, reject) => {
    const req = https.request(urlOptions, async res =>  {
      // res.statusCode == 302 res.statusCode > 300 && res.statusCode < 400 && res.headers.location
      if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
        return request(res.headers.location).then(resolve).catch(reject);
      } else {
        resolve(res);
      };
    });
    req.on('error', reject);
    req.end();
  });
};

module.exports = request;