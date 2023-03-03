import * as api from "./api.js";
import { fire } from "../aid/index.js";

/**
 * Server MiddleWare
 */
export default class MiddleWare {
  // /**
  //  * @private
  //  */
  // framework;
  // /**
  //  * @param {express.Express} framework
  //  */
  // constructor(framework) {
  //   this.framework = framework;
  // }

  /**
   * set static directory
   * @param {string} dir
   * @example
   * const app = server();
   * app.use(app.middleware.static("static"));
   *
   * .framework.use(routes.static("static"));
   */
  static(dir) {
    return api.server.static(dir);
  }

  /**
   * Route Menu
   * @param {api.ServerRequest} req
   * @param {api.ServerResponse} res
   * @param {api.ServerNextFunction} next
   * @example
   * const app = server();
   * app.use(app.middleware.menu);
   *
   * .framework.use(app.middleware.menu);
   */
  menu(req, res, next) {
    // const uri = url.parse(req.originalUrl);
    const url = req.originalUrl;
    // console.log("uri", uri);

    api.route.nav = {};
    for (let index = 0; index < api.route.menu.length; index++) {
      const elm = api.route.menu[index];
      // elm.class = "";

      if (elm.url == url) {
        elm.class = "current";
      } else if (url.startsWith(elm.url) && elm.url != "/") {
        elm.class = "active";
      } else if (fire.route.pass(elm.url).test(url)) {
        elm.class = "active";
      } else {
        elm.class = "";
      }
      console.log("pathname", url, "->", elm.url, elm.class);

      if (api.route.nav.hasOwnProperty(elm.group)) {
        api.route.nav[elm.group].push(elm);
      } else {
        api.route.nav[elm.group] = [elm];
      }
    }
    console.log("pathname", "-----------", req.originalUrl);
    res.locals.nav = api.route.nav;
    next();
  }

  /**
   * Route guard
   * @param {api.ServerRequest} req
   * @param {api.ServerResponse} res
   * @param {api.ServerNextFunction} next
   */
  guard(req, res, next) {}
}
