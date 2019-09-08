module.exports = {
  env:'.env',
  name: "evh",
  version: "1.0",
  // middleware: 'middleware.js',
  // route: 'route.js',
  // config: 'config.js',
  starter:{
    main: "index.js",
    middleware: 'middleware.js',
    route: 'route.js',
    config: 'config.js',
  },
  directory:{
    static: 'static',
    assets: 'assets',
    views: 'views',
    routes: 'routes'
  },
  environment:{
    port:80,
    virtual:[],
    name:'Unknown'
  },
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
  },
  configuration:{}
};

/*
{
	"port": "80",
	"app": "app",
	"share": "share",
	"starter": "index.js",
	"virtual": {
    "../zaideih":["0.0.0.0","*.*","*"]
	},
	"available": {
		"../testEvh":["test.local"],
		"../myordbok":["myordbok.*","myordbok.*.*"],
		"../zaideih":["zaideih.*","zaideih.*.*"],
		"./app/default":["127.0.0.1","*"],
		"any":["0.0.0.0","*.*","*"]
	}
}
*/