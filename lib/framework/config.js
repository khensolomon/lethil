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
 * @property{[k: string]: string}
 */
export const environment = {
  mysqlConnection:null,
  mongoConnection:null
};

/**
 * @property{[k: string]: any}
 */
export const user = {
  name:'',
  version:'',
  description:'',
  development:true,
  bucket:'',
  storage:'',
  media:'',
  lethil:{
    version: ''
  },
  // starterMain:'',
  /**
   * @type {RegExp[]} referer
   */
  referer:[],
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
  },
  /**
   * @type {any[]} locale
   */
  locale:[
    // {id:'en',name:'English',default:true}
  ],
};

export const Params = process.argv.splice(2);

/**
 * @property {[k: string]: any}
 */
export const middleware = {};

/**
 * @property {[k: string]: any}
 */
export const view = {
  /**
   * @type {any} engine
   */
  engine: null,
  /**
   * @type {string} engine
   */
  extension: '.pug',
};

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
