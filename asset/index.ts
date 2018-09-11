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
const assignment:any = {};
// const assignment:any = module.exports = root;
// const assignment:any = module.exports = {rootConfiguration,path,fs,rootAssist,rootObject,rootArray};

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

// TODO: ??
import * as database from './database';
export const mysql = database.connection.mysql;
export const mongodb = database.connection.mongodb;

export const world:string = 'world';
export const hello:string = 'Hello';

export default assignment;