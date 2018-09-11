/*!
 * expressVirtual
 * Copyright(c) 2018 Khen Solomon Lethil
 * MIT Licensed
 */
// NOTE: path,fs,rootConfiguration,rootAssist,rootObject,rootArray
declare function require(path: string): any;
// NOTE: Essential
import * as root from './essential';
export const utility=root.utility;
export const rootSetting=root.configuration.setting;
export const rootDirectory=root.configuration.directory;
export const path=root.request.path;
export const fs=root.request.fs;

// NOTE: Assignment
export const assignment:any = {};
// const assignment:any = module.exports = root;

// NOTE:  Scriptive
import * as $ from './scriptive';

export const scriptive=$.http;
export const express=$.express;
// TODO: ?
export const cookieParser = $.cookieParser;
export const morgan = $.morgan;
export const sassMiddleWare = $.sassMiddleWare;

// TODO: ?
export const httpErrors = $.httpErrors;

// console.log(scriptive);
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
// const assignment:any = module.exports = {rootConfiguration,path,fs,rootAssist,rootObject,rootArray};

// export const assignment:any = {config};
// export default assignment;


// TODO: ??
import * as database from './database';
// assignment.mysql = database.connection.mysql;
export const mysql = database.connection.mysql;
// assignment.mongodb = database.connection.mongodb;
export const mongodb = database.connection.mongodb;
// assignment.testing = database.connection.testing;

export const world:string = 'world';
export const hello:string = 'Hello';
export default assignment;
