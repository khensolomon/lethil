// import url from "url";
import * as api from "./api.js";
// import { fire } from "../aid/index.js";
import { fire, default as aid } from "../aid/index.js";
import * as env from "./env.js";

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
   * set static directory for development
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
   * Returns middleware that only parses json and only looks at requests where the Content-Type header matches the type option.
   * @param {any} [options]
   * @example
   * const app = server();
   * app.use(app.middleware.json());
   */
  json(options) {
    return api.server.json(options);
  }

  /**
   * Returns middleware that only parses urlencoded bodies and only looks at requests where the Content-Type header matches the type option
   * @param {any} [options]
   * @example
   * const app = server();
   * app.use(app.middleware.urlencoded({ extended: true }));
   */
  urlencoded(options) {
    return api.server.urlencoded(options);
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

    const pathname = req.path;

    const uri = pathname.split("/")[1];

    if (api.route.menu.find((e) => e.url.startsWith("/" + uri))) {
      api.route.nav = {};
      for (let index = 0; index < api.route.menu.length; index++) {
        const elm = api.route.menu[index];
        // elm.class = "";

        if (elm.url == pathname) {
          elm.class = "current";
        } else if (pathname.startsWith(elm.url) && elm.url != "/") {
          elm.class = "active";
        } else if (fire.route.pass(elm.url).test(pathname)) {
          elm.class = "active";
        } else {
          elm.class = "";
        }

        if (api.route.nav.hasOwnProperty(elm.group)) {
          api.route.nav[elm.group].push(elm);
        } else {
          api.route.nav[elm.group] = [elm];
        }
      }
    }

    res.locals.nav = api.route.nav;
    next();
  }

  /**
   * Route guard
   * @param {api.ServerRequest} req
   * @param {api.ServerResponse} res
   * @param {api.ServerNextFunction} next
   */
  guard(req, res, next) {
    if (req.headers.referer) {
      var ref = aid.parse.url(req.headers.referer);
      res.locals.referer = req.headers.host == ref.host;

      // ref.host == host;
      // req.headers.referer -> https://myordbok.lethil.me
      // req.headers.host -> myordbok
      // req.headers.host -> myordbok.lethil.me
      // ref.host - myordbok.lethil.me
    }

    if (res.locals.referer) {
      // NOTE: internal

      const requestedInternal = req.originalUrl.split("/")[3];
      // req.xhr ||
      if (requestedInternal == "audio") {
        if (req.headers.range) {
          return next();
        }
      } else {
        return next();
      }
    } else {
      // NOTE: external
      const base = Object.keys(env.config.restrict),
        user = Object.keys(req.query),
        key = base.find((e) => user.includes(e));
      if (key && env.config.restrict[key] == req.query[key]) {
        return next();
      }
    }
    res.status(404).end();
  }

  /**
   * Cookie theme
   * @param {api.ServerRequest} req
   * @param {api.ServerResponse} res
   * @param {api.ServerNextFunction} next
   */
  theme(req, res, next) {
    var theme = "auto";
    if (req.cookies.theme || req.cookies.theme != undefined) {
      theme = req.cookies.theme;
    } else {
      // NOTE: No need to set, client script should do it
      // res.cookie("theme", theme);
    }
    res.locals.themeMode = theme;
    next();
  }
}
