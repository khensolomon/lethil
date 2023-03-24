// import { EventEmitter } from "events";
import * as api from "./api.js";
import { Core } from "./core.js";
import * as handler from "./handler.js";
import aid from "../aid/index.js";

/**
 * @example
 * process.argv.splice(2)
 * npm start [?]
 * npm run [?]
 * node run [?]
 */
export class Command extends Core {
  constructor() {
    super();
    const args = process.argv.splice(2);
    const url = aid.parse.cli(args);
    const route = aid.parse.url(url);

    /**
     * @type {api.CommandRequest}
     */
    this.req = {
      url: url,
      route: route,
      query: route.query,
      params: {},
    };
  }

  /**
   * Command routes block
   * @example
   * routes()
   * routes("/","api")
   */
  routes() {
    return new api.Command();
  }

  /**
   * Callback is executed upon success
   * @param {(res:any) => void} callback
   */
  async listen(callback) {
    try {
      const route = handler.route(this.req);
      if (route) {
        var res = route.callback(this.req);
        if (res instanceof Promise) {
          res = await res;
        }
        callback(res);
      } else {
        // this.evt.emit("error", "No route exists: " + this.req.url);
        // console.log(this.req);
        if (this.req.url) {
          this.error = "No route exists: " + this.req.url;
          // throw new Error("No route exists: " + this.req.url);
        } else {
          this.error = "No route exists";
          // throw new Error("No route exists");
        }
      }
    } catch (/**@type {any} */ error) {
      this.error = error.message | error;
    }
  }

  // /**
  //  * @typedef {[event: "listen", listener: (req:api.CommandRequest, callback:(msg?:any) => void) => void]} listen
  //  * typedef {[event: "success", listener: (res?:any) => void]} success
  //  * @typedef {[event: "error", listener: (msg:string) => void]} error
  //  * typedef {[event: "done", listener: () => void]} done
  //  *
  //  * @param {listen|error} rest
  //  *
  //  * param {[event: "error", listener: (err: Error) => void]} rest
  //  * param {[event: "close", listener: () => void]} rest
  //  * param {[event: "request", listener: (req:api.CommandRequest, callback:api.CommandCallback) => void]} rest
  //  * param {[event: string | symbol, listener: (...args: any[]) => void]} rest
  //  * param {[event: string, listener: (...args: any[]) => void]} rest
  //  * {any} rest arguments (evt, listener)
  //  * param {[error|success|close|request]} rest
  //  * param {[event: "error", listener: (err: Error) => void]|[event: "success", listener: () => void]|[event: "close", listener: () => void]} rest
  //  * @example
  //  * .on("execute", async (req, callback) => "Ok");
  //  * .on('success', (e) => console.log(e));
  //  * .on('error', (e) => console.log(e));
  //  * .on('done', () => console.log('closed'));
  //  */
  // on(...rest) {
  //   // return this.evt.on.apply(this.evt, rest);
  //   // return this.evt.on.apply(this.evt, rest);
  //   return this.evt.on.apply(this.evt, rest);
  // }
}
