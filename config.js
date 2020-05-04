module.exports = {
  env:'.env',
  name: "evh",
  version: "1.1.1",
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
    PORT:80,
    LISTEN:'localhost',
    virtual:{}
  },
  common:{
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