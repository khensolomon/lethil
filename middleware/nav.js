const path = require("path");
const fs = require('fs');
var childName = 'child', urlHome = '/';

module.exports = class nav {
  constructor(user,parents) {
    this.app = user;
    this.parents = parents;
    this.routes={};
  }

  insert(localName){
    localName = localName || '_';
    if (!this.routes.hasOwnProperty(localName)) this.routes[localName]=new Array();
    return new nav(this.app,this.routes[localName]);
  }

  child(){
    var lastIndex = this.parents.length - 1;
    if (!this.parents[lastIndex].hasOwnProperty(childName)) this.parents[lastIndex][childName]=new Array();
    return new nav(this.app,this.parents[lastIndex][childName]);
  }
  route(a){
    // console.log(path.join(this.app.Config.dir.routes, a.route+'.js'));
    // if(a.hasOwnProperty('route'))this.app.Core.use(a.url,require(path.join(this.app.Config.dir.routes, a.route+'.js')));

    try {
      if(a.hasOwnProperty('route'))this.app.Core.use(a.url,require(path.join(this.app.Config.dir.routes, a.route)));
    } catch (error) {
      console.log(error);
    }
    this.parents.push(a);
    return this;
  }
  get register(){
    // TODO: improve routes?:any
    var routes = this.routes;
    return (req, res, next)=>{
      var hasActive=false, hasHome=-1;
      var routeActive = (a,i,c) => {
        if (a.hasOwnProperty('active')) {
          if (a.url != urlHome) delete a.active;
        }
        if (a.url == urlHome) {
          hasHome=i; a.active=true;
        }
        if (req.path == a.url){
          a.active=true;
          hasActive=i;
          if (a.url != urlHome && hasHome >= 0 && c[hasHome].url == urlHome) delete c[hasHome].active;
        } else if (a.url != '*' && new RegExp('^' + a.url,'i').test(req.originalUrl)) {
          a.activeChild=true;
          a.active=true;
          if (hasHome >= 0 && c[hasHome].url == urlHome) delete c[hasHome].active;
        } else if (a.url == '*' && !hasActive) {
          a.active=true;
          hasActive=i;
        }
        return routeMap(a);
      };
      var routeSort = (e) => e.sort((a,b) =>  a.id - b.id);
      var routeMap = (e) => {
        if (e.hasOwnProperty(childName)) {
          routeSort(e[childName]).map(routeActive);
        }
        return e;
      };
      for(var id in routes) res.locals[id] = routeSort(routes[id]).map(routeActive);
      next();
    }
  }
}


/*
import * as root from '../service/';
var rootRequest=root.request,
    rootUtility=root.utility,
    childName = 'child',
    urlHome = '/';

export class middleware {
  private routes:any={};
  constructor(private user?:any,private parents?:any) {
  }
  insert(localName:string='_'){
    if (!this.routes.hasOwnProperty(localName)) this.routes[localName]=new Array();
    return new middleware(this.app,this.routes[localName]);
  }
  child(){
    var lastIndex = this.parents.length - 1;
    if (!this.parents[lastIndex].hasOwnProperty(childName)) this.parents[lastIndex][childName]=new Array();
    return new middleware(this.app,this.parents[lastIndex][childName]);
  }
  route(a?:any){
    if(a.hasOwnProperty('route'))this.app.Core.use(a.url,require(rootRequest.path.join(this.app.Config.dir.routes, a.route)));
    this.parents.push(a);
    return this;
  }
  get register(){
    // TODO: improve routes?:any
    var routes = this.routes;
    return (req?:any, res?:any, next?:any)=>{
      var hasActive=false,
          hasHome=-1,
          routeActive = (a?:any,i?:any,c?:any) => {
            if (a.hasOwnProperty('active')) {
              if (a.url != urlHome) delete a.active;
            }
            if (a.url == urlHome) {
              hasHome=i; a.active=true;
            }
            if (req.path == a.url){
              a.active=true;
              hasActive=i;
              if (a.url != urlHome && hasHome >= 0 && c[hasHome].url == urlHome) delete c[hasHome].active;
            } else if (a.url != '*' && new RegExp('^' + a.url,'i').test(req.originalUrl)) {
              a.activeChild=true;
              a.active=true;
              if (hasHome >= 0 && c[hasHome].url == urlHome) delete c[hasHome].active;
            } else if (a.url == '*' && !hasActive) {
              a.active=true;
              hasActive=i;
            }
            return routeMap(a);
          },
          routeSort = (e:any) => {
            return e.sort((a?:any,b?:any) =>  a.id - b.id);
          },
          routeMap = (e:any) => {
            if (e.hasOwnProperty(childName)) {
              routeSort(e[childName]).map(routeActive);
            }
            return e;
          };
      for(var id in routes) res.locals[id] = routeSort(routes[id]).map(routeActive);
      next();
    }
  }
  static error(err?:any, req?:any, res?:any, next?:any){
    // NOTE: set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // NOTE: render the error page
    res.status(err.status || 500);
    res.render('error');
    // res.status(404).send('Sorry, we cannot find that!');
    // res.redirect(301, '/');
    // console.log(req.path);
    // res.redirect(307,'/');
    // res.render('index');
    next();
  }
}
*/