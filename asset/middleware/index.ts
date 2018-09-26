// import * as root from '../essential';
// var rootRequest=root.request,
//     rootUtility=root.utility;

import * as route from './route';
import * as js from './script';
export const script = js.middleware;
export class nav extends route.middleware{}
// export const script = (option?:{}) => new js.middleware(option).register();
// export const style = (option?:{}) => new css.middleware(option).register();



// TODO: compression
// const compression = require('compression')
// export const compression = ()=>compression();


/*
var nav = new middleware.nav(user);
user.app.use(nav.register());
user.nav = (Id:string)=>nav.insert(Id);
*/