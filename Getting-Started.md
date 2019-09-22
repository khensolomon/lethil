# Getting Started

You probably wanted to skip *Getting started* as we focus on the basic initiation of NPM Package. However, you may notice that dependencies **@scriptive/evh** should be in package.json.

```json
...
"dependencies": {
  "@scriptive/evh": "https://github.com/scriptive/evh/tarball/master"
}
```

... if not, install it!

```shell
npm install --save https://github.com/scriptive/evh/tarball/master
```

## Setup

Let us say, we...

- are in `/var/www/app` directory
- have `example.com` domain name
- need 2 applications, `example.com` for main `other.example.com` for other stuffs.

> create a file `.env` for Environment

```shell
# default port is: 80
port=80

virtual=/var/www/main:example.com,www.example.com;../other:*.example.com,*
```

- `example.com` or `www.example.com` point to **/var/www/main**
- `*.example.com` point to **/var/www/other**


> create a file `index.js`

```js
const scriptive = require("@scriptive/evh");

module.exports = scriptive;
scriptive.server();
```

## static

- [Getting Started](Getting-Started.md#getting-started)