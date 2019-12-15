module.exports = {
  env:'.env',
  name: "evh",
  version: "1.0.4",
  root:null,
  starter:{
    command: 'command.js',
    main: "index.js",
    config: 'config.js',
    middleware: 'middleware.js',
    route: 'route.js',
    initiator: 'initiator.js'
  },
  directory:{
    static: 'static',
    assets: 'assets',
    views: 'views',
    routes: 'routes'
  },
  proxy:{
    single:true
  },
  environment:{
    port:80,
    // portSecure:443,
    virtual:{},
    listen:'localhost'
    // certificate:null
  },
  common:{
    // forceHTTPS:0,
    // forceWWW:0,
    development:null,
    referer:[],
    restrict:{}
  },
  // configuration:{},
  middleware:{
    // style: {
    //   // prefix: '/css',
    //   // indentedSyntax: false,
    //   // debug: true,
    //   // response:false,
    //   // NOTE: nested, expanded, compact, compressed
    //   // outputStyle: 'compressed',
    //   // sourceMap: false
    // },
    // script: {
    //   // prefix:'/jsmiddlewareoutput'
    // }
  },
  status:{
    fail:[],
    warn:[]
  }
};