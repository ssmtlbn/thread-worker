
/**
 * This function is sent to the workers and is executed there immediately.
 * 
 * @private
 * @type {function}
 */
var workerCode = function() {

  /**
   * Reference to the worker itself.
   * 
   * @private
   * @type {Worker}
   */
  var worker = self;

  /**
   * A regular expression to check if a string is a absolute URL.
   * 
   * @private
   * @type {RegExp}
   */
  var ABSOLUTE_URL_REG_EXP = new RegExp('^(?:[a-z]+:)?//', 'i');

  /**
   * The function to be executed.
   * 
   * @private
   * @type {function}
   */
  var fn = null;

  /**
   * The location of the file that initited the execution of this worker.
   * 
   * @private
   * @type object
   * @property {string} protocol The protocol scheme of the URL, including the 
   * final ':'.
   * @property {string} hostname The domain of the URL.
   * @property {string} port the port number of the URL.
   * @property {string} pathname An initial '/' followed by the path of the URL.
   */
  var execLocation = null;

  /**
   * An array containing the URLs of the dependencies to load.
   * 
   * @private
   * @type {Array<string>}
   */
  var dependencies = [];

  /**
   * Processes incoming messages.
   * 
   * @private
   * @param {MessageEvent} evt The message event.
   */
  function onMessage(evt) {
    var msg = evt.data;

    switch(msg.cmd) {
      case 'SET_UP':
        setUp(msg.setup);
        break;
      case 'RUN':
        run(msg.args);
        break;
      case 'RESET':
        reset();
        break;
      default:
        throw new Error('Unknown command: ' + msg.cmd);
    };
  };
  
  /**
   * Set up the environment for the function to be executed.
   * 
   * @private
   * @param {object} setup Properties to set up the environment.
   * @param {object} setup.fn The function to be executed.
   * @param {string} setup.fn.params The function parameters as string.
   * @param {string} setup.fn.body The function body as string.
   * @param {object} setup.execLocation The location of the file that initited
   * the execution of this worker.
   * @param {string} setup.execLocation.protocol The protocol scheme of the 
   * URL, including the final ':'.
   * @param {string} setup.execLocation.hostname The domain of the URL.
   * @param {string} setup.execLocation.port the port number of the URL.
   * @param {string} setup.execLocation.pathname An initial '/' followed by 
   * the path of the URL.
   * @param {RequireJsConfig} [setup.requirejs] Properties to load and set up
   * RequireJS.
   * @param {Array<string>} setup.dependencies Relative or absolute URLs to 
   * scripts that should be imported into the worker. <br />
   * If RequireJS is configured: Module names of modules that will be passed 
   * to the function to be executed.
   */
  function setUp(setup) {

    // Build function
    fn = Function.apply(null, setup.fn.params.concat(setup.fn.body));

    // Set location
    execLocation = setup.execLocation;

    if(setup.requirejs) {

      var rjsConf = setup.requirejs;

      // Import requirejs script
      importScripts(toAbsoluteURL(rjsConf.url));

      // Configure requirejs
      var intRjsConf = rjsConf.config || {};

      // Set absolute baseUrl
      if(intRjsConf.baseUrl) {
        intRjsConf.baseUrl = toAbsoluteURL(intRjsConf.baseUrl);
      } else {
        // Not baseUrl is specified, set absolute URL of the location
        // of the executing file
        intRjsConf.baseUrl = toAbsoluteURL('./');
      }
      
      require.config(intRjsConf);

      var dataMainDependency = [];
      if(rjsConf.dataMain) {
        dataMainDependency = [rjsConf.dataMain];
      }
      require(dataMainDependency, function() {

        // Load dependencies with RequireJS
        if(setup.dependencies) {
          require(setup.dependencies, function() {
            dependencies = Array.prototype.slice.call(arguments);
            post({cmd: 'SET_UP'});
          });
        } else {
          // No dependencies to load

          post({cmd: 'SET_UP'});
        }

      });
    } else {
      if(setup.dependencies) {
        // Import dependencies
        setup.dependencies.forEach(function(dependency) {
          importScripts(toAbsoluteURL(dependency));
        });
      }
      post({cmd: 'SET_UP'});
    }
  }

  /**
   * Starts the function to be executed.
   * 
   * @private
   * @param {Array|undefined} args Data arguments to be passed to the function 
   * or undefined if there are no arguments to pass. Will be concatenated
   * with the resolve-/reject-functions and the dependencies automatically.
   */
  function run(args) {
    try {
      fn.apply(null, [resolve, reject].concat(dependencies, args));
    } catch (error) {
      reject(error);
    }

  };
  
  /**
   * The function to resolve the thread.
   * 
   * @private
   * @param {*} [value] The result.
   */
  function resolve(value) {
    post({cmd: 'RESOLVE', result: value});
  }

/**
 * The function to reject the thread.
 * 
 * @private
 * @param {*} [reason] The reason for the rejection.
 */
  function reject(reason) {
    if(reason instanceof Error) {
      // Error is not cloneable, convert to simple object

      var errObj = {
        type: 'error',
        message: reason.toString(),
        fileName: reason.fileName,
        lineNumber: reason.lineNumber,
        columnNumber: reason.columnNumber
      };
      reason = errObj;
    }
    post({cmd: 'REJECT', reason: reason});
  }
  
  /**
   * Resets this worker.
   * 
   * @private
   */
  function reset() {
    fn = null;
    post({cmd: 'RESET'});
  }

  /**
   * Sends the given message to the underlying thread.
   * 
   * @private
   * @param {*} message The message to be sent.
   */
  function post(message) {
    worker.postMessage(message);
  };

  /**
   * Converts the given relative URL to an absolute URL.
   * 
   * @private
   * @param {string} relativeUrl The relative URL.
   * @returns {string} Absolute URL.
   */
  function toAbsoluteURL(relativeUrl) {
    if(ABSOLUTE_URL_REG_EXP.test(relativeUrl)) {
      // Url is absolute

      return relativeUrl;
    } else {
      var baseParts = execLocation.pathname.split('/'),
          relativeParts = relativeUrl.split('/');

      // remove trailing filename or empty string
      baseParts.pop();
      
      // remove leading empty string if available
      if(baseParts.length > 0 && baseParts[0] === '') {
        baseParts.shift();
      };

      for(var i = 0; i < relativeParts.length; i++) {
        if(relativeParts[i] === '.') {
          continue;
        }
        if(relativeParts[i] === '..') {
          baseParts.pop();
        } else {
          baseParts.push(relativeParts[i]);
        }
      }
      return execLocation.protocol + '//' + execLocation.hostname + ':' 
              + execLocation.port + '/' + baseParts.join('/');
    }
  }
  
  // Add message listener to worker
  worker.addEventListener('message', onMessage);
  
  // Notify underlying thread that the worker has been initialised.
  post({cmd: 'INIT'});
  
}.toString();

// Create ObjectURL from worker code
var workerObjectURL = URL.createObjectURL(new Blob(
        ['(', workerCode, ')()'], {type: 'application/javascript'}));