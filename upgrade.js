const fs = require('fs');
const path = require('path');
const tar = require('tar');
const scriptive = require('./package.json');
const {ask} = require("./service");

const scriptiveName = scriptive.name;
const root = require.main.paths[0].split('node_modules')[0].slice(0, -1);
var old = require(path.join(root,'package.json'));
var url = old.repository.url.replace('git+','').replace('.git','/archive/master.tar.gz');
var directory = path.join(root);

const extractData = async function(urlOptions) {
  return await ask.request(urlOptions).then(
    res => res.pipe(tar.x({strip:1, C:directory}))
  );
};

// const saveData = async function(urlOptions) {
//   return ask.request(urlOptions).then(res=>{
//     var file = fs.createWriteStream(path.join(directory,'master.tar.gz'));
//     res.pipe(file);
//     file.on('finish', function() {
//       file.close();
//     });
//   });
// };


async function makeup(){
  const file = path.join(directory,'package.json');
  if (fs.existsSync(file)){
    const json = await fs.promises.readFile(file).then(e=>JSON.parse(e)).catch(()=>new Object());
    if (json.dependencies[scriptiveName].includes("file:")){
      if (old.dependencies[scriptiveName].includes("file:")) {
        json.dependencies[scriptiveName]='^'+scriptive.version;
      } else {
        json.dependencies[scriptiveName]=old.dependencies[scriptiveName];
      }
    }
    delete json.devDependencies;
    await fs.promises.writeFile(file,JSON.stringify(json,null,2));
    // fs.unlinkSync(path.join(directory,'package-lock.json'));
    return old.version +' -> '+json.version;
  } else {
    return 'Extracted, but no package.json, probably it is initial!';
  }
}

module.exports = function(dir=''){
  directory = path.join(root,dir);
  return new Promise(function(res,rej){
    if (root == directory && old.dependencies[scriptiveName].includes("file:")){
      rej('Master repository can not replace!');
    } else {
      extractData(url).then(
        (e) => e.on('finish',
          () => makeup().then(res).catch(rej)
        )
      );
    }
  });
};
