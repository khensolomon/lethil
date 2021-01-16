import {ServerResponse} from "http";
/**
 * @extends ServerResponse
 */
export class Response extends ServerResponse{
  /**
   * `Object.setPrototypeOf(res, Response.prototype)`
   * @example res.status(200).send('hello world');
   * @example res.status(404).send('Not found');
   * @fires `this.statusCode = status; res.end("Not found");`
   * @param {number} status
   */
  status(status) {
    this.statusCode = status;
    return this;
  }

  /**
   * @example res.send('Goodbye');
   * @param {any} message
   */
  send(message){
    this.end(message);
  }

  /**
   * @param {object} data
   */
  json(data) {
    this.setHeader("Content-Type", "application/json");
    this.end(JSON.stringify(data));
  }

  /**
   * @param {string} template
   * param {[k: string]: any} data
   * @param {any} data
   */
  render(template, data={}){
    // this.render('home', { title: 'Zaideih',description:'Zaideih Music Station',keywords:'zola, mp3, myanmar' });
    // this.setHeader("Content-Type", "text/html");
    this.end(template);
  }
}