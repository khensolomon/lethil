/*!
 * expressVirtual
 * Copyright(c) 2018 Khen Solomon Lethil
 * MIT Licensed
 */
// NOTE: path,fs,rootConfiguration,rootAssist,rootObject,rootArray
declare function require(path: string): any;
import './essential';

// NOTE:  Module dependencies.
import * as scriptive from './scriptive';
// scriptive.serve.http
// const {expressVirtual,express,environments,debug} = require('./virtual');
// const expressTest = require('./express-test');
// const app = express();
/*
const {server} = require('@scriptive/evh');
scriptive
rootProject, rootHttp, rootServer
var server = new expressVirtual;
// NOTE: Optional
// server.port(3000);
// server.root(__dirname);
server.start();
server.error();
server.listening();
*/
// NOTE: Configurations
const assignment:any = module.exports = {rootConfiguration,path,fs,rootAssist,rootObject,rootArray};

// TODO: ??
// assignment.moduleElemental
assignment.cookieParser = require('cookie-parser');
assignment.morgan = require('morgan');
assignment.sassMiddleWare = require('node-sass-middleware');

// TODO: ??
assignment.httpErrors = require('http-errors');

// TODO: ??
import * as database from './database';
assignment.mysql = database.connection.mysql;
assignment.mongo = database.connection.mongo;