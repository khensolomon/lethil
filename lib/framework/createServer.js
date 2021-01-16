import * as http from "http";
// import {createServer,RequestListener} from "http";
import {Request} from "./request.js";
import {Response} from "./response.js";

/**
 * @param {http.RequestListener} listener
 */
// export default (listener) => http.createServer({IncomingMessage: Request,ServerResponse: Response},listener);
export default () => http.createServer({IncomingMessage: Request,ServerResponse: Response});

/**
 * @param {*} req
 * @param {*} res
 */
/*
    this.server = createServer(
      async(req, res) => {

        const requestMethod = req.method.toLowerCase();
        const requestURL = req.url;

        // if (requestURL == '/favicon.ico') return res.status(404).send('Not found');
        const route = routeActive(requestURL,req);

        if (route){
          const routeMethod = Object.keys(route.type);
          const availableMethod = routeMethod.includes(requestMethod)?requestMethod:routeMethod[0];
          const responseMethod = route.type[availableMethod];

          // let body = await readBody(req);
          // if (this.parseMethod === "json") {
          //   body = body ? JSON.parse(body) : {};
          // }
          // req.body = body;

          // if (await processMiddleware(middleware, req, res)) {
          //   return callback(req, res);
          // }

          try {
            for (const mwa of $.route.middleware.concat({path:route.path,callback:responseMethod.middleware})) {
              await processMiddleware(mwa.callback, req, res);
            }
            const responseCallback = responseMethod.callback(req, res);
            if (responseCallback instanceof Promise){
              responseCallback.catch(
                () => null
              );
            }
          } catch (error) {
            res.status(500).send(error.message);
          }
        } else {
          res.status(404).send('Not found');
        }
      }
    );
*/