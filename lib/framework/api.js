import express from "express";
import event from "events";

/**
 * command Core
 * @typedef {Object} CommandRequest - for CLI route
 * @property {string} url
 * property {typeof aid.parse.ParseURL} route - ParseURL
 * @property {URL} route - ParseURL
 * @property {Object} params
 * @property {Object} query
 *
 * @typedef {(req:CommandRequest)=>any} CommandCallback
 *
 */
export const command = event;

/**
 * server Core
 * @typedef {express.Request} ServerRequest - Express request object
 * @typedef {express.Response} ServerResponse - Express response object
 * @typedef {express.NextFunction} ServerNextFunction - Express next middleware function
 *
 * @typedef {() => void} voidCallback - used in listen
 *
 * @typedef {Object} TypeOfRoutePath
 * @property {string} [url] - route path
 * @property {string} [name] - route name
 * @property {string} [text] - Label
 * @property {string} [group]
 *
 * @typedef {(req:ServerRequest,res:ServerResponse,next:ServerNextFunction)=>void} ServerCallback
 *
 * @typedef {{[k:string]:ServerCallback}} TypeOfRouteMethod
 *
 * @typedef {Object} TypeOfRoutePage
 * @property {TypeOfRoutePath|string} path
 * @property {TypeOfRouteMethod|ServerCallback} method
 * @property {TypeOfRoutePage} [page]
 *
 * @typedef {{[k:string]:ServerCallback|TypeOfRouteMap}} TypeOfRouteMap
 *
 */
export const server = express;

/**
 * @typedef {Object} TypeOfMenu - for GUI navigation
 * @property {string} url
 * @property {string} name
 * @property {string} text
 * @property {string} group
 * @property {string} class
 *
 * @typedef {Object} TypeOfList - for CLI route
 * @property {string} path
 * @property {CommandCallback} callback
 */
export const route = {
  /**
   * navigations for GUI
   * @type {TypeOfMenu[]}
   */
  menu: [],
  /**
   * routes for CLI
   * @type {TypeOfList[]}
   */
  list: [],
  /**
   * navigation
   * @type {{[k:string]:TypeOfMenu[]}}
   */
  nav: {},

  test: {},
};

export class Command {
  /**
   * @private
   */
  settings = {
    url: "/",
    group: "",
  };
  /**
   * @param {string} [url]
   * @param {string} [group]
   */
  constructor(url, group) {
    if (url) {
      this.settings.url = url;
    }
    if (group) {
      this.settings.group = group;
    }
  }

  /**
   * Route registration for Command
   * @param {string} path
   * @param {CommandCallback} callback
   * @example
   * command("/", (req)=>void)
   * $ node run /
   */
  register(path, callback) {
    route.list.push({ path: path, callback: callback });
  }
}

export class Server {
  /**
   * @private
   */
  api;
  /**
   * @private
   */
  settings = {
    url: "/",
    group: "",
  };

  /**
   * @param {express.Express} api
   * @param {string} [url]
   * @param {string} [group]
   */
  constructor(api, url, group) {
    this.api = api;
    if (url) {
      this.settings.url = url;
    }
    if (group) {
      this.settings.group = group;
    }
  }

  /**
   * Route registration for Server
   * @param {[string|TypeOfRoutePath,ServerCallback]|[TypeOfRoutePage]} e
   * @example
   * register(
   *  "/",
   *  (req, res) => res.json({ app: req.app })
   * );
   *
   * register(
   *  { url: "/:uid", name: "account", text: "Profile" },
   *  (req, res) => res.json({ params: req.params.uid })
   * );
   *
   * register({
   *  path: "/query",
   *  method: (req, res) => res.json({ query: req.query })
   * });
   *
   * register({
   *  path: "/api",
   *  method: (req, res) => res.json({}),
   *  page: {
   *    path: "/userlist",
   *    method: (req, res) => res.json({}),
   *  }
   * });
   */
  register(...e) {
    const lens = e.length;

    if (lens == 2 && typeof e[1] == "function") {
      if (typeof e[0] == "string") {
        // register("", (req,res)=>{})
        this.serverRoute("get", this.settings.url + e[0], e[1]);
      } else if (typeof e[0] == "object" && e[0].hasOwnProperty("text")) {
        // register({url:?,name:?, text:"", group:?}, (req, res) => {});
        this.routePath(e[0], e[1]);
      }
    } else if (lens == 1 && typeof e[0] == "object") {
      this.routePage(e[0]);
    }
  }

  /**
   * @todo also add to menu
   * @param {TypeOfRoutePath} elm
   * @param {ServerCallback} callback
   * @private
   * @example
   * routePath({ url: "/:uid", name: "account", text: "Profile" }, (req, res) => {})
   * addToMenu addToList
   * add
   */
  routePath(elm, callback) {
    // if (!elm.url || elm.url == "") {
    //   elm.url = this.settings.url;
    // }
    if (elm.url) {
      elm.url = this.settings.url + elm.url;
    } else {
      elm.url = this.settings.url;
    }
    if (!elm.name) {
      elm.name = "";
    }
    if (!elm.group || elm.group == "") {
      elm.group = this.settings.group;
    }
    var obj = Object.assign(
      { url: "", name: "", text: "", group: "", class: "" },
      elm
    );
    this.menu(obj);
    this.serverRoute("get", elm.url, callback);
  }

  /**
   * Route registration
   * @private
   * @param {TypeOfRoutePage} routePage
   * @param {string} [routeUrl]
   * @param {string} [routeGroup]
   *
   * @example
   * routePage({
   *  path: "/user/:name",
   *  method: (req, res) => res.json({ a: req.params.name }),
   * });
   * routePage({
   *  path: {url:"/", name:"home", text:"Home", group:"main"},
   *  method: (req, res) => res.json({ a: req.params.name }),
   * });
   * pageMap pageUrl pageGroup
   * page url group
   */
  routePage(routePage, routeUrl, routeGroup) {
    // if (routeUrl) {
    //   routeUrl = this.settings.url + routeUrl;
    // } else {
    //   routeUrl = this.settings.url;
    // }

    routeUrl = routeUrl ? this.settings.url + routeUrl : this.settings.url;
    // routeUrl = routeUrl || this.settings.url;
    routeGroup = routeGroup || this.settings.group;
    for (const key in routePage) {
      if (Object.hasOwnProperty.call(routePage, key)) {
        // @ts-ignore
        const elm = routePage[key];
        const tys = typeof elm;
        if (elm) {
          if (key == "path") {
            if (tys == "object") {
              routeUrl = (routeUrl + elm.url).replace("//", "/");
              // routeUrl = routeUrl + elm.url;
              // routeUrl += elm.url;
              if (elm.hasOwnProperty("group")) {
                routeGroup = elm.group;
              } else {
                elm.group = routeGroup;
              }
              elm.url = routeUrl;
              this.menu(elm);
            } else if (typeof elm == "string") {
              routeUrl = (routeUrl + elm).replace("//", "/");
              // routeUrl = routeUrl + elm;
              // routeUrl += elm;
            }
          }
          if (key == "method") {
            if (tys == "object") {
              for (const method in elm) {
                if (Object.hasOwnProperty.call(elm, method)) {
                  const callback = elm[method];
                  this.serverRoute(method, routeUrl, callback);
                  // if (method == "get") {}
                }
              }
            } else if (tys == "function") {
              this.serverRoute("get", routeUrl, elm);
            }
          }
          if (key == "page" && tys == "object") {
            this.routePage(elm, routeUrl, routeGroup);
            break;
          }
        }
      }
    }
  }

  /**
   * Add to server routing
   * @private
   * @param {any} method - [get, post, delete, put]
   * @param {any} url - "/"
   * @param {any} callback - ()=>
   */
  serverRoute(method, url, callback) {
    // console.log("%s: %s", method, url);
    // @ts-ignore
    this.api[method](url, callback);
  }

  /**
   * add to menu
   * @param {TypeOfMenu} elm
   * @private
   */
  menu(elm) {
    elm.class = "";
    route.menu.push(elm);
  }
}
