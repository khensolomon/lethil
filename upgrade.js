const fs = require('fs');
const path = require('path');
const tar = require('tar');
const https = require('https');
// const request = require('request'); // to removed
const scriptive = require('./package.json');
const {readFilePromise,writeFilePromise} = require("./service");
const scriptiveName = scriptive.name;
const root = require.main.paths[0].split('node_modules')[0].slice(0, -1);
const old = require(path.join(root,'package.json'));

var url = old.repository.url.replace('git+','').replace('.git','/archive/master.tar.gz');
var directory = path.join(root);

async function upgrade() {
  // || Object.keys(old.devDependencies).length
  if (root == directory && old.dependencies[scriptiveName].includes("file:")){
    throw 'Master repository can not replace!';
  } else {
    // return await downloadAndExtract(url);
    return await extractData(url);
    // return await saveData(url);
    // return await downloadAndExtract(url);

  }
}

const requests = function(urlOptions) {
  return new Promise((resolve, reject) => {
    const req = https.get(urlOptions, async res =>  {
      // res.statusCode == 302 res.statusCode > 300 && res.statusCode < 400 && res.headers.location
      if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
        return requests(res.headers.location).then(resolve).catch(reject);
      } else {
        resolve(res);
      };
    });
    req.on('error', reject);
    req.end();
  });
};

const extractData = async function(urlOptions) {
  return requests(urlOptions).then(res=>{
    res.pipe(tar.x({strip:1, C:directory}))
    // console.log('ok');
  });
};

const saveData = async function(urlOptions) {
  return requests(urlOptions).then(res=>{
    var file = fs.createWriteStream(path.join(directory,'master.tar.gz'));
    res.pipe(file);
    file.on('finish', function() {
      file.close();
    });
  });
};


async function makeup(){
  const file = path.join(directory,'package.json');
  if (fs.existsSync(file)){
    const json = await readFilePromise(file).then(e=>JSON.parse(e)).catch(()=>new Object());
    // const json = require(file);
    if (json.dependencies[scriptiveName].includes("file:")){
      if (old.dependencies[scriptiveName].includes("file:")) {
        json.dependencies[scriptiveName]='^'+scriptive.version;
      } else {
        json.dependencies[scriptiveName]=old.dependencies[scriptiveName];
      }
    }
    delete json.devDependencies;
    await writeFilePromise(file,JSON.stringify(json,null,2))
    return old.version +' -> '+json.version;
  } else {
    return 'Extracted, but no package.json, probably it is initial!';
  }
}


module.exports = function(dir=''){
  directory = path.join(root,dir);
  // return upgrade()
  // return new Promise(async function(res,rej){
  //   return upgrade().then(async () => {
  //     return await makeup().then(res);
  //   })
  // });
  return upgrade().then(() => makeup())
};

// module.exports = function(dir=''){
//   directory = path.join(root,dir);
//   return new Promise(function(res,rej){
//     upgrade().on('finish', e => {
//       if (e) {
//         rej(e);
//       } else {
//         try {
//           makeup().then(res).catch(rej);
//         } catch (error) {
//           rej(error);
//         }
//       }
//     }).on("end",function(e){
//       rej(e);
//     }).on("error",function(e){
//       rej(e);
//     })
//   });
// };

    // // return request(url).pipe(tar.x({strip:1, C:directory}));
    // var file = fs.createWriteStream(path.join(directory,'master.tar.gz'));
    // return https.get(url, function(response) {
    //   // response.pipe(unzip.Extract({path:'./'}))
    //   // response.pipe(tar.x({strip:1, C:directory}));
    //   // response.pipe(fs.createWriteStream(path.join(directory,'master.tar.gz')));
    //   var body = [];
    //   if (response.statusCode == 302) {
    //     body = [];
    //     request(response.headers.location);
    //   } else {
    //     response.on("data", function(chunk){
    //       file.on('open', function(){
    //         file.write(chunk);
    //       });
    //     });
    //     response.on("end", function(){
    //       console.log('done');
    //     });
    //   };
    // });
    // var request = http.get(URL, function(response) {
    //   response.pipe(unzip.Extract({path:'./'}))
    // });

    // var file = fs.createWriteStream(path.join(directory,'master.tar.gz'));
      // res.pipe(unzip.Extract({path:'./'}))
      // res.pipe(tar.x({strip:1, C:directory}));
      // res.pipe(fs.createWriteStream(path.join(directory,'master.tar.gz')));

      // var file = fs.createWriteStream(path.join(directory,'master.tar.gz'));
      // res.on("data", function(chunk){
      //   file.on('open', function(){
      //     file.write(chunk);
      //   });
      // });
      // res.on("end", function(){
      //   console.log('done');
      // });

      // var file = fs.createWriteStream(path.join(directory,'master.tar.gz'));
      // res.pipe(file);
      // file.on('finish', function() {
      //   file.close();
      // });


      // const request = function(url,data='') {
      //   return new Promise((resolve, reject) => {
      //     const req = https.get(url, (res) => {
      //       // var body = [];
      //       // res.statusCode == 302 res.statusCode > 300 && res.statusCode < 400 && res.headers.location
      //       if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
      //         return request(res.headers.location,data);
      //       } else {
      //         console.log('????');
      //         return resolve(res);
      //         // res.on("data", resolve);
      //         // response.on("data", function(chunk){
      //         //   resolve(res);
      //         // });
      //         // res.on('end', () => {
      //         //   if (res.statusCode >= 200 && res.statusCode <= 299) {
      //         //     resolve(res);
      //         //   } else {
      //         //     reject('Request failed. status: ' + res.statusCode + ', body: ' + body);
      //         //   }
      //         // });
      //         // res.on('error', reject);
      //         // let body = '';
      //         // res.on('data', (chunk) => (body += chunk.toString()));
      //         // res.on('error', reject);
      //         // res.on('end', () => {
      //         //   if (res.statusCode >= 200 && res.statusCode <= 299) {

      //         //     // resolve({statusCode: res.statusCode, headers: res.headers, body: body});
      //         //     resolve(res);
      //         //   } else {
      //         //     reject('Request failed. status: ' + res.statusCode + ', body: ' + body);
      //         //   }
      //         // });
      //       };
      //     });
      //     req.on('error', reject);
      //     // req.write(data, 'binary');
      //     // console.log('?222');
      //     req.end();
      //   });
      // };


    // const downloadAndExtract = async (url) => await request(url).then(e=>e.pipe(tar.x({strip:1, C:directory}))).catch(e=>console.log(e));
// const downloadAndExtract = function(url) {
//   return https.get(url, (res) => {
//     if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
//       return request(res.headers.location);
//     } else {
//       return res.pipe(tar.x({strip:1, C:directory}));
//     };
//   });
// };

// const downloadAndSave = function(url) {
//   return https.get(url, (res) => {
//     // var body = [];
//     // res.statusCode == 302 res.statusCode > 300 && res.statusCode < 400 && res.headers.location
//     if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
//       return request(res.headers.location);
//     } else {
//       var file = fs.createWriteStream(path.join(directory,'master.tar.gz'));
//       res.pipe(file);
//       file.on('finish', function() {
//         file.close();
//       });
//     };
//   });
// };
