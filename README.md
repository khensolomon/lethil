# Readme

expressvirtual, express-all-in-one, jsxpressvirutal,expressvirtual


// npm uninstall (Get-ChildItem).Name
// npm install C:\server\nodecore
// npm link C:\server\nodecore
// npm uninstall express-virtual



{

  "scripts": {
    "test": "mocha -r ts-node/register test/index.spec.ts",
    "package": "node test/package",
    "build:node": "tsc",
    "build:web": "webpack",
    "build": "npm run build:node && npm run build:web"
  },
  "files": [
    "configuration.js",
    "index.js",
    "notation.js",
    "min.js"
  ],
  "devDependencies": {
    "@types/mocha": "^5.2.5",
    "@types/node": "^10.9.4",
    "mocha": "^5.2.0",
    "ts-loader": "^5.0.0",
    "ts-node": "^7.0.1",
    "typescript": "^3.0.3",
    "webpack": "^4.17.2",
    "webpack-cli": "^3.1.0"
  }
}

npm i -D @types/mocha @types/node mocha ts-loader ts-node typescript webpack webpack-cli

express, path, util, querystring

http-errors, cookie-parser, morgan, node-sass-middleware


let createError = require('http-errors'),
    express = require('express'),
    path = require('path'),
    cookieParser = require('cookie-parser'),
    logger = require('morgan'),
    sassMiddleware = require('node-sass-middleware');


```
/*
"cookie-parser": "*",
"debug": "*",
"dotenv": "*",
"express": "*",
"fs-extra": "^7.0.0",
"hbs": "^4.0.1",
"http-errors": "^1.7.0",
"moby": "^1.1.2",
"morgan": "*",
"myanmar-notation": "^1.0.1",
"mysql": "^2.16.0",
"node-sass-middleware": "*",
"npm": "^6.4.0",
"pug": "*",
"vhost": "*"
*/

// let myanmarNotation = require('./notation');
module.exports = {
  serve:function () {
    console.log('serve yes...')
  }
};
```
```shell
npm install express
# npm install debug
# npm install http-errors
npm install fs-extra
npm install vhost
npm install dotenv

npm install cookie-parser

npm install morgan
npm install node-sass-middleware

npm install pug
npm install hbs

npm install mysql
```