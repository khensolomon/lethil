module.exports = {
  env:'.env',
  name: "evh",
  version: "1.0.2",
  starter:{
    command: 'command.js',
    main: "index.js",
    config: 'config.js',
    middleware: 'middleware.js',
    route: 'route.js'
  },
  directory:{
    static: 'static',
    assets: 'assets',
    views: 'views',
    routes: 'routes'
  },
  environment:{
    port:80,
    portSecure:443,
    virtual:[],
    certificate:null
  },
  common:{
    forceHTTPS:true,
    forceWWW:null,
    development:null,
    referer:[],
    restrict:{}
  },
  // configuration:{},
  middleware:{
    style: {
      // prefix: '/css',
      // indentedSyntax: false,
      // debug: true,
      // response:false,
      // NOTE: nested, expanded, compact, compressed
      // outputStyle: 'compressed',
      // sourceMap: false
    },
    script: {
      // prefix:'/jsmiddlewareoutput'
    }
  },
  status:{
    fail:[],
    warn:[]
  }
};