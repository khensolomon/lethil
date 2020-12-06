# scriptive/evh

... is **Node.js** web server, simple and flexible configuration using *Express.js* & *vhost* that allow developer to deploy multiply applications simultaneously, and which has a very minimum requirement and aim to provided as light as possible.

```properties
npm install --save @scriptive/evh
# or
npm install --save https://github.com/scriptive/evh/tarball/master
```

> ... don't worry, it will not installed anything that doesn't use by "*evh"* to run your applications.

## How does it work

- [Getting Started](Getting-Started.md#getting-started)

## upgrade.js

read *package.json* file then...

```json
...
"repository": {
  "type": "git",
  "url": "git+https://github.com/scriptive/zaideih.git"
},
...
```

```js
const upgrade = require("@scriptive/evh/upgrade");

upgrade('test/upgrade').then(
  e=>console.log('>',e)
).catch(
  e=>console.error('>',e)
)
```
