import { EventEmitter } from "events";
import * as api from "./api.js";
import { Core } from "./core.js";
import aid from "../aid/index.js";

export class Command extends Core {
  /**
   * @returns {api.CommandRequest}
   */
  get req() {
    /**
     * @type {string[]}
     * @example
     * process.argv.splice(2)
     * npm start [?]
     * npm run [?]
     * node run [?]
     */
    const args = process.argv.splice(2);
    const url = aid.parse.cli(args);
    const route = aid.parse.url(url);

    return {
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
   * @type {EventEmitter}
   */
  evt = new EventEmitter();

  /**
   * @param {(error?:any) => void} [listener] - is executed upon complete as a callback
   */
  listen(listener) {
    this.evt.emit("listen", this.req, listener);
  }

  /**
   * @typedef {[event: "listen", listener: (req:api.CommandRequest, callback:(msg?:any) => void) => void]} listen
   * typedef {[event: "success", listener: (res?:any) => void]} success
   * @typedef {[event: "error", listener: (msg:string) => void]} error
   * typedef {[event: "done", listener: () => void]} done
   *
   * @param {listen|error} rest
   *
   * param {[event: "error", listener: (err: Error) => void]} rest
   * param {[event: "close", listener: () => void]} rest
   * param {[event: "request", listener: (req:api.CommandRequest, callback:api.CommandCallback) => void]} rest
   * param {[event: string | symbol, listener: (...args: any[]) => void]} rest
   * param {[event: string, listener: (...args: any[]) => void]} rest
   * {any} rest arguments (evt, listener)
   * param {[error|success|close|request]} rest
   * param {[event: "error", listener: (err: Error) => void]|[event: "success", listener: () => void]|[event: "close", listener: () => void]} rest
   * @example
   * .on("execute", async (req, callback) => "Ok");
   * .on('success', (e) => console.log(e));
   * .on('error', (e) => console.log(e));
   * .on('done', () => console.log('closed'));
   */
  on(...rest) {
    // return this.evt.on.apply(this.evt, rest);
    return this.evt.on.apply(this.evt, rest);
  }

  /**
   * @param {number | undefined} [code]
   */
  exit(code) {
    // this.evt.emit("done");
    process.exit(code);
  }
}
