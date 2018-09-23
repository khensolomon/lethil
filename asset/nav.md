
- [ ] Navigator
- [ ] Responsive
- [ ] Flexible
- [ ] Multi dimension
    - [ ] Child deep

```js

// new menu('mainMenu').route();
// app.menu('mainMenu').route();
app.nav('fes').route();

module.exports = function(app){

  app.nav('navPage')
    .route({url: '/',route: 'home', text: 'Home'})
    .route({url: '/about',routes: 'about', text: 'Parent'})
    .children()
      .route({url: '/about/nothing',routes: 'home', text: 'Child'})
      .children()
        .route({url: '/about/nothing/final',routes: 'home', text: 'Final'});
        
  // app.use('/definition', require(path.join(score.dir.routes, 'definition')));
  // app.use('/api', require(path.join(score.dir.routes, 'api')));
  // app.use('*',require(path.join(score.dir.routes, 'home')));

  // app.route({url: '/',route: 'home', text: 'Home',id:0});
  // app.route({url: '/api',route: 'api', text: 'API',id:5});
  // app.route({url: '/about',route: 'home', text: 'About',id:4});
  // app.route({url: '/fonts',route: 'home', text: 'Fonts',id:3});
  // app.route({url: '/grammar',route: 'home', text: 'Grammar',id:2});
  // app.route({url: '/definition',route: 'definition', text: 'Definition',id:1});
  // app.route({url: '*',route: 'home', text: 'fallback',id:10});

  app.nav('API').route({url: '/api',route: 'api', text: 'API',id:5});

  app.nav('API').route({url: '/api',route: 'api', text: 'API',id:5}).children({});


  var Page = app.nav('pageMenu');
  Page.route({url: '/about',route: 'home', text: 'About',id:4});
  Page.route({url: '*',route: 'home', text: 'Home',id:0});
}


var application = module.exports = function(app){
  // console.log(application.apple);
  // var app=score.app();
  app.nav('navAPI')
    .route({url: '/api',route: 'api', text: 'API'});

  app.nav('navDictionary')
    .route({url: '/definition',route: 'definition', text: 'Definition'});

  app.nav('navTerms')
    .route({url: '/privacy',route: 'home', text: 'Privacy'})
    .route({url: '/terms',route: 'home', text: 'Terms'});

  // e.nav('navPage')
  //   .route({url: '/',route: 'home', text: 'Home'})
  //   .route({url: '/about',route: 'about', text: 'About'})
  //   .route({url: '/myanmar-fonts',route: 'home', text: 'Fonts'})
  //   .route({url: '/grammar',route: 'home', text: 'Grammar'});
  // var abc = app.nav('navPage');
  app.nav('navPage')
    .route({url: '/',route: 'home', text: 'Home'})
    .route({url: '/about',route: 'about', text: 'About'});
      // .children({url: '/test',route: 'about', text: 'About'});
  app.nav('navPage')
    .route({url: '/myanmar-fonts',route: 'home', text: 'Fonts'})
    .route({url: '/grammar',route: 'home', text: 'Grammar'});

  app.nav('navFallback')
    .route({url: '*',route: 'home', text: 'Fallback'})
};

routes={
  'Page':[]
  'API':[]
};


var routeConfiguration ={
  "/definition":{
    route:"definition",
    text:"Definition",
    child:{

    }
  },
  "/api":{
    route:"api",
    text:"API"
  },
  "/about":{
    route:"about",
    text:"About"
  },
  "/myanmar-fonts":{
    route:"fonts",
    text:"Font"
  },
  "/grammar":{
    route:"grammar",
    text:"Grammar"
  },
  "/*":{
    route:"home",
    text:"Home"
  }
};

```