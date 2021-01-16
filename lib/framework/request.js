import {IncomingMessage} from "http";
/**
 * @extends IncomingMessage
 * @todo ?
 */
export class Request extends IncomingMessage {
  params = Object.create(null);
  query = Object.create(null);
}