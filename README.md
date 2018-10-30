# evh

...**@scriptive/evh** is NodeJS based framework using express, vhost

## Installation

> Start with `npm init`, then

```shell
npm i @scriptive/evh
```

> create *index.js*

```js
const scriptiveModule=()=>require('@scriptive/evh');
module.exports = scriptiveModule;
const {scriptive} = scriptiveModule();

var server = new scriptive();
// OPTIMIZE: .port(3000) is optional, default port number based on `.env`
// server.port();

// OPTIMIZE: .root(__dirname) is optional, default root directory based `process.mainModule.paths`
// server.root();

// NOTE: .listen(), to start listening http
server.listen();

// OPTIMIZE: .error(callback) is optional, to catch http errors. callback executed when http errors found!
server.error();

// OPTIMIZE: .listening(callback) is optional. callback executed when listening process.
server.listening();

// OPTIMIZE: .close(callback) is optional. callback executed when listening is stop.
server.close();

// HACK: .stop(), to stop listening!
// server.stop();
```

> *scriptive.json* `virtual[directory]=[domainname]`. Use wildcard/* for multi listening.

```json
{
	"virtual": {
		"../example":["domainname.extension","subdomainname.domainname.extension"],
		"../other":["other.*"],
		"../name":["domainname.*","domainname.*.*"],
		"./app/default":["127.0.0.1","*"]
	}
}
```

> *.env* Environments configuration file

```
port=80
```