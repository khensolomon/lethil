# example

... index.js

```js
import core from 'scriptive';
import mysql from 'mysql';
import mongodb from 'mongodb';
import config from './config.js';

core.set('root','./test?');
core.set('hostname','localhost');
core.set('port',8087);
core.set('config',config);
core.set("mysql",mysql)
core.set("mongo",mongodb)

core.init();

export default core;
```

... serve.js

```js
import {server, router} from './index.js';

const app = server();

// 'id','urlPrefix'
const page = router('nav_page','/');


page.get({url:'/', text: 'Home'}, function(req, res) {
  res.send('Home...')
});

page.get({url:'/about', text: 'About'}, function(req, res) {
  res.send('About...')
});

page.get('/none', function(req, res) {
  res.status(404).send('Not found');
});

// 'id','urlPrefix'
const api = router('nav_api','/api');

api.get('/', function(req, res) {
  res.json(req.params)
});

api.get('/:id', function(req, res, next) {
  if (req.params.id == '101') {
    next()
  } else {
    res.status(401).send('Not allowed')
  }
}, (req, res) => {
  res.send('Protected route using {req.params.id}');
});

api.post('/json', function(req, res) {
  res.json(req.params)
});

// app.listen(process.env.PORT, process.env.HOST, () => {
//   console.log(config.name,config.HOST,config.PORT);
//   app.close();
// });
// app.listen(() => {
//   console.log(config.name,config.HOST,config.PORT);
// })
app.core.listen(() => {
  // app.core.address().port
  console.log(config.name,config.HOST,config.PORT);
})
```

... run.js

```js
import {command} from './index.js';
import task from './task.js';

const app = command();
command(task).then(
  e => {
    if (e) console.log('>',e);
  }
).catch(
  e => {
    console.error('!',e)
  }
);
```

... task.js

```js
export const main = async () => 'Ok';
export const apple = async () => 'Apple is good for health';
export default main;
```

...........

## tmp

```js
import scriptive from 'scriptive';
// import mysql from 'mysql';
// import mongodb from 'mongodb';

const config = scriptive.config();
scriptive.server().then(
  app => app.listen(process.env.PORT, process.env.HOST, () => {
    console.log(config.name,config.HOST,config.PORT);
    app.close();
    // process.exit(1);
  })
).catch(
  err => console.error(err)
);


// const app = scriptive.server();
// app.factor.mysql = mysql;
// app.factor.mongo = mongodb;
// export default app;

// const core = scriptive();
scriptive.factor.mysql = mysql;
scriptive.factor.mongo = mongodb;
const db = scriptive.db();

db.mysql.factor = '';
db.mongo.factor = '';

const app = scriptive.server();
app.listen(process.env.PORT, process.env.HOST, () => {
  console.log(config.name,config.HOST,config.PORT);
  app.close();
  // process.exit(1);
})
app.listen(() => {
  console.log(config.name,config.HOST,config.PORT);
})


// export default {mysql, mongodb };
import route from './route.js';
import config from './config.js';

scriptive.route = route;
scriptive.config = config;


const app = scriptive.server();

app.set('route',route);
app.set('config',config);
app.factor(mysql);
app.factor(mongo);

app.Navigator('navPage').add('/','home.js', 'Home');
app.Navigator('navAPI').add('/api','api.js', 'API');

const routes = app.Router();

routes.get('/', function(req, res) {
  res.send('Home...')
});
routes.get({url:'/', text: 'Home'}, function(req, res) {
  res.send('Home...')
});



app.listen(process.env.PORT, process.env.HOST, () => {
  console.log(config.name,config.HOST,config.PORT);
  app.close();
  // process.exit(1);
});
app.listen(() => {
  console.log(config.name,config.HOST,config.PORT);
})
app.core.listen(() => {
  console.log(config.name,config.HOST,config.PORT);
})
export default app;

const app = scriptive.command();

```
