/*!
 * scriptive/evh
 * Copyright(c) 2018 Khen Solomon Lethil
 * MIT Licensed
 */
declare function require(path: string): any;
// NOTE: Essential, service
import * as root from './service/';
export const utility=root.utility;
export const rootSetting=root.configuration.setting;
export const rootDirectory=root.configuration.directory;
export const path=root.request.path;
export const fs=root.request.fs;

// NOTE: Assignment
const assignment:any = {};
// const assignment:any = module.exports = {rootConfiguration,path,fs,rootAssist,rootObject,rootArray};

// NOTE:  Scriptive
import * as $ from './scriptive';

export const scriptive=$.http;
export const express=$.express;
export const essence=$.essence;

// TODO: ?
export const cookieParser = $.cookieParser;
export const morgan = $.morgan;
// TODO: remove???
export const nodeSASSMiddleWare = $.nodeSASSMiddleWare;

// TODO: ?
export const httpErrors = $.httpErrors;

// TODO: ??
import * as db from './database/';
export const database = db.connection;
// export const mysql = db.connection.mysql;
// export const mongodb = db.connection.mongodb;

export default assignment;