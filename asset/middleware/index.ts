// import * as root from '../essential';
// var rootRequest=root.request,
//     rootUtility=root.utility;

import * as route from './route';
import * as script from './script';
import * as style from './style';

export const js = (option?:{}) => new script.middleware(option).register;
export class nav extends route.middleware{};
export class css extends style.middleware{};


// TODO: compression
// const compression = require('compression')
// export const compression = ()=>compression();


/*
var nav = new middleware.nav(user);
user.app.use(nav.register());
user.nav = (Id:string)=>nav.insert(Id);
*/