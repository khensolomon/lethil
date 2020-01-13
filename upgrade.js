const fs = require('fs');
const path = require('path');
const tar = require('tar');
const request = require('request');
const scriptive = require('./package.json');
const {readFilePromise,writeFilePromise} = require("./service");
const scriptiveName = scriptive.name;
const root = process.mainModule.paths[0].split('node_modules')[0].slice(0, -1);
const old = require(path.join(root,'package.json'));

var url = old.repository.url.replace('git+','').replace('.git','/archive/master.tar.gz');
var directory = path.join(root);

function download(){
  // || Object.keys(old.devDependencies).length
  if (root == directory && old.dependencies[scriptiveName].includes("file:")){
    throw 'Master repository can not replace!';
  } else {
    return request(url).pipe(tar.x({strip:1, C:directory}));
  }
}

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
    return 'Extracted, but no package.json';
  }
}

module.exports = function(dir=''){
  directory = path.join(root,dir);
  return new Promise(function(res,rej){
    download().on('finish', e => {
      if (e) {
        rej(e);
      } else {
        try {
          makeup().then(res).catch(rej);
        } catch (error) {
          rej(error);
        }
      }
    })
  })
}