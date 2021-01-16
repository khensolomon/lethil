# lethil

[![Build Status][travis]][travis-url]
[![npm][npm-download]][npm-dl-url]
[![Webpack][webpack-check]][webpack-url]
![Mocha][test-mocha]

...`lethil` is a minimal and configurable Node.js web framework, it has no dependencies but customizable that allow developer to deploy multiply applications simultaneously, and which has a very minimum requirement and aim to provided as light as possible.

```properties
npm install --save lethil
# or
npm install --save https://github.com/khensolomon/lethil/tarball/master
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

[![License: MIT][license]][license-url]

[test-mocha]: https://img.shields.io/badge/test-mocha-green.svg?longCache=true
[webpack-check]: https://img.shields.io/badge/webpack-yes-green.svg?longCache=true
[webpack-url]: https://unpkg.com/myanmar-notation@latest/min.js
[travis]: https://travis-ci.com/khensolomon/myanmar-notation.svg
[travis-url]: https://travis-ci.org/khensolomon/myanmar-notation
[npm-download]: https://img.shields.io/npm/dt/myanmar-notation.svg
[npm-dl-url]: https://www.npmjs.com/package/myanmar-notation
[license]: https://img.shields.io/badge/License-MIT-brightgreen.svg?longCache=true&style=popout-square
[license-url]: https://opensource.org/licenses/MIT