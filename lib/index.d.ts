/// <reference path="./service/index.d.ts" />

import service from "./service/index";

export const aid = service.aid;
export const utility = service.utility;
export const ask = service.ask;
export const timer = service.timer;
export const burglish = service.burglish;

namespace scriptive {

  /**
   * configuration
   */
  function set(name?:string,rest?:any): any;

  function db(): $.db;
  function config(): $.config.user;

  /**
   * set tasks or routes
   * @returns $.Route
   */
  function route(name?:string,rest?:any): $.Route;

  /**
   * void
   */
  // function init(): void;

  // interface route {any}
  // const route: any;
  const testing: any;

  /**
   * run command line.
   */
  function command(): any;

  /**
   * start server.
   */
  function server(): any;

  interface PlatformPath {
    abc:number
  }
}

export default scriptive;
// const scriptive: scriptive.PlatformPath;


// export = scriptive;
