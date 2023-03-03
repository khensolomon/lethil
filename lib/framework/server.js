import http from "http";
import * as api from "./api.js";
import { Core } from "./core.js";
import middleware from "./middleware.js";

export class Server extends Core {
  constructor() {
    super();
    this.framework = api.server();
  }

  // /**
  //  * @return {{method:string; path:string}[]}
  //  */
  // get route() {
  //   return this.framework._router.stack
  //     .filter((r) => r.route)
  //     .map((r) => {
  //       return {
  //         method: Object.keys(r.route.methods)[0].toUpperCase(),
  //         path: r.route.path,
  //       };
  //     });
  // }

  /**
   * @typedef {api.ServerCallback} abc
   * param {[string]|[path:string,subApplication:abc|any]} e
   * @param {[any]|[abc]|[path:string,subApplication:abc|any]} e
   */
  use(...e) {
    if (e.length == 2) {
      this.framework.use(e[0], e[1]);
    } else {
      this.framework.use(e[0]);
    }
    // return this.framework.use.apply(this.framework, e);
  }

  /**
   * Disable `setting`
   * @param {string} setting
   */
  disable(setting) {
    this.framework.disable(setting);
  }

  /**
   * Enable `setting`
   * @param {string} setting
   */
  enable(setting) {
    this.framework.enable(setting);
  }

  /**
   * @param {(file:string)=>any} compiler - pug.compileTemplate
   * @example
   * .pug((file) =>  pug.compileFile(file));
   */
  pug(compiler) {
    /**
     * @type {Object.<string,any>} - pug.compileTemplate
     */
    const template = {};
    this.framework.engine("pug", (filePath, options, callback) => {
      // var file = aid.seek.resolve($.app.dir.root, $.app.dir.views, filename);
      // rendered = pug.renderFile(filePath, options);
      // rendered = pug.compileFile(filePath);
      // return callback(null, rendered);
      if (!template.hasOwnProperty(filePath)) {
        template[filePath] = compiler(filePath);
      }
      const engine = template[filePath];
      return callback(null, engine(options));
    });
    this.framework.set("view engine", "pug");
  }

  /**
   * Server routes block
   * @param {string} [url]
   * @param {string} [group]
   * @example
   * routes()
   * routes("/","api")
   */
  routes(url, group) {
    return new api.Server(this.framework, url, group);
  }

  /**

   * @example
   * middleware.[menu,static]
   * routes("/","api")
   */
  get middleware() {
    return new middleware();
  }

  /**
   * http listener, see {@link express.Express.listen|Express listen}
   * param {[handler:any,listeningListener?:api.voidCallback]|[number]|[api.voidCallback]|[number,api.voidCallback]|[number,string,api.voidCallback]} e
   * @param {[handler:any,listener?:api.voidCallback]|[number]|[api.voidCallback]|[number,api.voidCallback]} e
   * @returns {http.Server}
   * @example
   * .listen() - "just listen"
   * .listen(3000) - "listen port"
   * .listen(3000,()=>{}) - "listen port then callback"
   * .listen(3000,"localhost",function(){}) - "listen port, hostname then callback"
   */
  listen(...e) {
    return this.framework.listen.apply(this.framework, e);
    // return this.framework.listen.apply(e);
    // return this.framework.listen.call(this.framework, e);
    // return this.framework.listen.bind(e);
  }

  /**
   * param {[event: 'error', listener: (err: Error) => void]} rest
   * param {[event: 'close', listener: () => void]} rest
   * param {[event: string | symbol, listener: (...args: any[]) => void]} rest
   * param {[event: string, listener: (...args: any[]) => void]} rest
   * {any} rest arguments (evt, listener)
   * example
   * .on("request", async (req, callback) => "Ok");
   * .on('executing', console.log);
   * .on('success', (e) => console.log(e));
   * .on('error', (e) => console.log(e));
   * .on('close', () => console.log('closed'));
   */
  // on(...options) {
  //   return this.framework.on.apply(this.framework, rest);
  // }

  // get on() {
  //   return this.framework.on;
  // }
}
