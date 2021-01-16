// @ts-check
/**
 * @property {[k: string]: string}
 */
export const starter = {
  env:'.env',
  json:'package.json'
  // config: 'config.js',
  // command: 'command.js',
  // main: "index.js",
  // middleware: 'middleware.js',
  // route: 'route.js'
  // initiator: 'initiator.js',
};

/**
 * {[k: string]: string}
 */
export const environment = {
  mysqlConnection:null,
  mongoConnection:null
};

// export interface user {
//   Config:Config,
//   Core:any,
//   sql:any,
//   mongo:any,
//   Navigation:any,
//   Router:any,
//   Param:any[]
// }

// export interface Config {
//   name:string,
//   version:string,
//   description:string,
//   development:boolean,
//   storage:'',
//   bucket:'',
//   media:'',
//   starterMain:string,
//   starterCommand:'',
//   starterRoute:'',
//   starterMiddleware:'',
//   referer:any,
//   restrict:{},
//   dir:dir,
// }

// export interface dir {
//   root: string,
//   static: string,
//   assets: string,
//   views: string,
//   routes: string,
// }

/**
 * @property Config
 * @property Core
 * @property sql
 * @property mongo
 * @property Navigation
 * @property Router
 * @property Param
 */

export const user = {
  name:'',
  version:'',
  description:'',
  development:true,
  bucket:'',
  storage:'',
  media:'',
  // starterMain:'',
  /**
   * @type {any} referer
   */
  referer:'',
  /**
   * @type {any} restrict
   */
  restrict:'',
  /**
   * @type {any} listen
   */
  listen:{
    host:'127.0.0.1',
    port:80
  },
  dir:{
    root: '',
    static: 'static',
    assets: 'assets',
    views: 'views',
    routes: 'routes'
  }
};
// export const db = { mysql:{},mongo:{}};
// export const sql = null;
// export const mongo = null;
// export const Core = null;
// export const Navigation = null;
// export const Router = null;
export const Params = process.argv.splice(2);

/**
 * ?
 * @property {[k: string]: any} middleware
 */
export const middleware = {};

/**
 * @property {string[]} name
 * @property {Array<any>} menu
 * @property {Array<any>} list
 */
export const route = {
  /**
   * @type {any} active
   */
  active: {},
  /**
   * @type {string[]} name
   */
  name: [],
  /**
   * @type {Array<any>} menu
   */
  menu: [],
  /**
   * @type {any[]} list
   */
  list: [],
  /**
   * @type {any[]} list
   */
  middleware: []
};

// route.menu
// route.active