// @ts-nocheck

import * as zlib from 'zlib';
import * as fs from 'fs';
// import * as path from 'path';
// import * as readline from 'readline';
// import * as ask from './service/ask';

export const create = async ()=>{
  var gzip = zlib.createGzip();
  var inp = fs.createReadStream('./tmp/test.txt');
  var out = fs.createWriteStream('./tmp/archive/abc.gz');

  return inp.pipe(gzip).pipe(out);
}
// async function d456f()  {
//   var output = fs.createWriteStream('./tmp/delete.tar.gz');
//   return await ask.request('https://github.com/scriptive/zaideih/archive/master.tar.gz').then(
//     (res:any) => res.pipe(zlib.createGunzip()).pipe(output)
//   );
// }

export const extract = async ()=>{
  const input = './tmp/delete.tar.gz';
  zlib.deflate(input, (err, buffer) => {
    if (err) {
      // handle error
      console.log(err)
    } else {
      console.log(buffer.toString('base64'));
    }
  });

  const buffer = Buffer.from('eJzT0yMAAGTvBe8=', 'base64');
  zlib.unzip(buffer, (err, buffer) => {
    if (err) {
      // handle error
      console.log(err)
    } else {
      console.log(buffer.toString());
    }
  });
}

// const line$ = (path: string) => readline.createInterface({
//   input: fs.createReadStream(path).pipe(zlib.createGunzip()),
//   crlfDelay: Infinity
// });

// export const extract = async () => {
//   let lineReader = readline.createInterface({
//     input: fs.createReadStream('./tmp/master.tar.gz').pipe(zlib.createGunzip())
//   });

//   let n = 0;
//   lineReader.on('line', (line) => {
//     n += 1
//     console.log("line: " + n);
//     console.log(line);
//   });
// }
// export const extract = async () => {
//   for await (const line of line$("./tmp/master.tar.gz")) {
//     console.log(line)
//   }
// }