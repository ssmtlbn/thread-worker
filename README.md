# thread-worker
JavaScript multithreading library using web workers. It simplifies the use of web workers and provides an easy way to run functions in real threads.

* Single threads
* Thread pools
* RequireJS support
* Promise support

## Installation
thread-worker is available as bower package.
```
bower install thread-worker
```

Or you can download the [latest release](https://github.com/ssmtlbn/thread-worker/releases/latest) from the [releases page](https://github.com/ssmtlbn/thread-worker/releases) and copy the files from `dist` folder to your project.

## Dependencies
To use thread-worker, the browser has to support web workers and promises.
## Getting started
thread-woker can be used as stand-alone library or as [RequireJS](http://requirejs.org/) module.

##### Standalone
To load it as stand-alone library just include the script into your page. thread-worker is then available as global object `threadWorker`.
``` html
<script src="path/to/thread-woker/thread-worker.min.js"></script>
```
##### RequireJS
To use thread-woker with RequireJS, simply fetch the module.
```javascript
var threadWorker = require('thread-worker');
```
## Usage
For a full list of available objects and functions, see the [API](http://ssmtlbn.github.io/thread-worker/).

More detailed usage examples coming soon.
