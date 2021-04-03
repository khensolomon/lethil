# Getting Started

You probably wanted to skip *Getting started* as we focus on the basic initiation of NPM Package. However, you may notice that dependencies **lethil** should be in package.json.

... if not already install!

```shell
npm init
npm i lethil
```

## Setup

Let's say, we...

- are in `/var/www/app` directory

> create a Environment file `.env`

```env
# NOTE: http Listen
listen = host:localhost;port:8086
# listen = host:0.0.0.0;port:8086

# NOTE: where media file are located
# storage = /var/www/storage


# NOTE: db
# mysqlConnection = mysql://user@host/dbName?flags=-FOUND_ROWS
# mongoConnection = mongodb+srv://user:pwd@host/dbName?retryWrites=true&w=majority

# NOTE: individual
restrict = key:value;anything:124;b:b1
referer = locahost.local;example.com
```

> create a file `config.js`

```js
export const setting = {
  name: 'MyApp',
  myobject:{},
  ....
};

export default {setting};
```

> create a file `core.js`

```js
import core from 'lethil';
import config from './config.js';

core.set('config',config.setting);

export default core;
```

> create a file `server.js`

```js
import core from './core.js';
import pug from 'pug';

core.set("pug",pug);

const app = core.server();
const config = app.config;
const route = app.route();

route.get('', function(req,res) {
  res.send('Hello World');
});

route.get('middle', function(req, res,next) {
  next();
},function(req, res) {
  res.send('Middleware testing');
});

app.listen(config.listen, () => {
  if (typeof app.address == 'object') {
    console.log(config.name,app.address.address,app.address.port);
  } else {
    console.log(config.name,app.address);
  }
  // app.close();
});

app.on('error',function(e){
  console.log('...',e);
});
```

> create a file `run.js`

```js
import {default as core} from 'lethil';

const app = core.route();

app.get("",async() => 'Ok');

app.post("",async() => 'none post Ok');

app.get('/middleware/:id', async(e) => {
  return 'middleware';
});

app.get("ok",async () => 'Ok');

app.get("async-error",async () => {
  throw 'what';
});

app.get("apple",async () => 'Did you know apple is fruit?');
app.get("test",() => "testing");
app.get("param/:id",async(e) => {
  // throw 'error?';
  console.log('at param',e);
  return 'from param';
});

app.get("/orange",async () => 'Orange is good for health');
```

> create a file `run.js`

```js
import core from './init.js';
import './task.js';

const app = core.command();
app.execute();

// NOTE: on success
app.on('success',(e)=>console.log('...',e));

// NOTE: on error
app.on('error',(e)=>console.log('...',e));

app.close();
```
