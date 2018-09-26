import * as root from '../service/';
var rootRequest=root.request,
    rootUtility=root.utility,
    childName = 'child',
    urlHome = '/';

export class middleware {
  private routes:any={};
  constructor(private core?:any,private parents?:any) {
  }
  insert(localName:string='_'){
    if (!this.routes.hasOwnProperty(localName)) this.routes[localName]=new Array();
    return new middleware(this.core,this.routes[localName]);
  }
  child(){
    var lastIndex = this.parents.length - 1;
    if (!this.parents[lastIndex].hasOwnProperty(childName)) this.parents[lastIndex][childName]=new Array();
    return new middleware(this.core,this.parents[lastIndex][childName]);
  }
  route(a?:any){
    if(a.hasOwnProperty('route'))this.core.app.use(a.url,require(rootRequest.path.join(this.core.score.dir.routes, a.route)));
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
            return routeEach(a);
          },
          routeSort = (e:any) => {
            return e.sort((a?:any,b?:any) =>  a.id - b.id);
          },
          routeEach = (e:any) => {
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
