export const starter = {
  /**
   * Environments
   */
  env: ".env",
  /**
   * Package
   */
  json: "package.json",
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
  mysqlConnection: null,
  mongoConnection: null,
};

/**
 * @typedef {object} config - Default configuration
 * @property {string} name - App name
 * @property {string} version - App version
 * @property {string} description - App description
 * @property {boolean} development - Return boolean: true on production
 * @property {string} bucket
 * @property {string} storage
 * @property {string} media
 *
 * @property {RegExp} referer
 * @property {any} restrict
 *
 * @property {object} lethil - Core
 * @property {string} lethil.version - Core version
 *
 * @property {object} listen - http listening hostname & port number
 * @property {string} listen.host - hostname
 * @property {number} listen.port - port number
 *
 * @property {object} dir - Directories
 * @property {string} dir.root - Root directory
 * @property {string} dir.static - Static directory
 * @property {string} dir.assets - Assets directory
 * @property {string} dir.views - View/Templdate directory
 * @property {string} dir.routes - Routes directory
 *
 * @property {any[]} locale
 *
 * @property {object} env - Used in deployment, get from package.json
 * @property {object} env.app - transferEnvironment, createOrUpdate
 * @property {string} env.app.name - transferEnvironment, createOrUpdate
 * @property {string} env.app.root - transferEnvironment, createOrUpdate
 * @property {string} env.app.repo - transferEnvironment, createOrUpdate
 *
 * @property {string} APP_NAME - Used in deployment, get from .env
 * @property {string} APP_ROOT - Used in deployment, get from .env
 * @property {string} SSH_USER - Used in deployment, get from .env
 * @property {string} SSH_HOST - Used in deployment, get from .env
 *
 * @property {string} gistId - Gist ID <user/id>
 * @property {string} gistToken - Gist Token
 */

/**
 * @type {config} - Application configuration
 */
export const config = {
  name: "",
  version: "",
  description: "",
  /**
   * @readonly
   */
  get development() {
    return !process.env.NODE_ENV || process.env.NODE_ENV.trim() != "production";
  },
  bucket: "",
  storage: "",
  media: "",
  referer: new RegExp(""),
  restrict: "",

  lethil: {
    version: "",
  },
  listen: {
    host: "127.0.0.1",
    port: 80,
  },
  dir: {
    root: "",
    static: "static",
    assets: "assets",
    views: "views",
    routes: "routes",
  },
  locale: [
    // {id:'en',name:'English',default:true}
  ],
  /**
   * Used in deployment, get from package.json
   */
  env: {
    app: {
      name: "",
      root: "",
      repo: "",
    },
  },
  /**
   * Used in deployment, get from .env
   */
  APP_NAME: "",
  APP_ROOT: "",
  SSH_USER: "",
  SSH_HOST: "",
  /**
   * Gist
   */
  gistToken: "",
  gistId: "",
};

// /**
//  * @property {[k: string]: any}
//  */
// export const view = {
//   /**
//    * @type {any} engine
//    */
//   engine: null,
//   /**
//    * @type {string} engine
//    */
//   extension: ".pug",
// };
