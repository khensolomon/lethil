# Lethil

[![Build Status][travis]][travis-url]
[![npm][npm-download]][npm-dl-url]
![npm][npm-version]
![Mocha][test-mocha]

...`lethil` is a minimal and configurable Node.js web framework, it has no dependencies but customizable and allow developer to deploy multiply applications simultaneously, and which has a very minimum requirement and aim to provided as light as possible.

```properties
npm install --save lethil
```

> ... don't worry, it will not installed anything that doesn't use by "*evh"* to run your applications.

## How does it work

### server

```js
// server.js
import core from 'lethil';

const app = core.server();
const config = app.config;

app.get('/', function(req, res) {
  res.send('Home')
});

app.get('/about', function(req, res) {
  res.send('About')
});

page.get('/none', function(req, res) {
  res.status(404).send('Not found');
});

app.get('/test/:id', function(req, res) {
  res.json(Object.assign({test:true},req.params,req.query));
});

app.listen(config.listen, () => {
  console.log(config.name,app.address.address,app.address.port);
  // NOTE: app.close() helps mysql pool connection gracefully end.
  // app.close();
});

```

> `node server`

### command

```js
// run.js
import core from 'lethil';

const app = core.command();

app.get('/', function(req) {
  return 'Main';
});
app.get('/about', function(req) {
  return 'About';
});

app.get('/test/:id', function(req) {
  return req.params.id
});

app.execute();

app.on('success',function(e) {
  console.log('...',e)
});

// NOTE: on error
app.on('error',function(e) {
  console.log('...',e)
});

app.close();

```

```properties
node run
node run about
node run test/123
```

- [Getting Started](Getting-Started.md#getting-started)

## License

[MIT](LICENSE)

[test-mocha]: https://img.shields.io/badge/test-mocha-green.svg?longCache=true
[travis]: https://travis-ci.com/khensolomon/lethil.svg
[travis-url]: https://travis-ci.com/khensolomon/lethil.svg?branch=master
[npm-download]: https://img.shields.io/npm/dt/lethil.svg
[npm-dl-url]: https://www.npmjs.com/package/lethil
[npm-version]: https://img.shields.io/npm/v/lethil.svg
