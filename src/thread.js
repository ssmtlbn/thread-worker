/**
 * A function that will be executed in a thread.
 * 
 * @typedef {function} ThreadFunction
 * @param {ThreadResolveFunction} resolve The function to resolve the thread.
 * @param {ThreadRejectFunction} reject The function to reject the thread.
 * @param {...*} [arguments] Custom arguments. 
 * @param {...string} [dependencies] Loaded dependencies (RequireJS only).
 */

/**
 * A function to resolve a thread.
 * 
 * @typedef {function} ThreadResolveFunction
 * @param {*} [result] The result of the function has been executed in the 
 * thread.
 */

/**
 * A function to reject a thread.
 * 
 * @typedef {function} ThreadRejectFunction
 * @param {*} [reason] The reason for the rejection.
 */

/**
 * Configuration options to load and set up RequireJS for a thread.
 * 
 * @typedef {object} RequireJsConfig
 * @property {string} url Relative or absolute URL to the RequireJS script.
 * @property {object} config RequireJS configuration options. The configuration 
 * options will be set diretly after RequireJS has been loaded.
 * See {@link http://requirejs.org/docs/api.html#config} for more
 * information about the configuration options.
 * @property {string} [dataMain] Relative or absolute URL to a data-main script. 
 * You will typically use a data-main script to set configuration options. It 
 * is executed directly after RequireJS has been configured. See 
 * {@link http://requirejs.org/docs/api.html#data-main} for more
 * information about data-main script.
 */

/**
 * Counter for thread ids.
 * 
 * @private
 * @type {number}
 */
var THREAD_ID_COUNTER = 1000;

/**
 * Creates a new thread.
 * 
 * @constructor
 * @returns {Thread} The newly created thead.
 */
function Thread() {
  
  /**
   * The id of this thread.
   * 
   * @private
   * @type {number}
   */
  this._id = THREAD_ID_COUNTER++;

  /**
   * The current state of this thread.
   * 
   * @type {Thread.State}
   * @private
   */
  this._state = Thread.State.NEW;

  /**
   * The job that is currently being processed.
   * 
   * @type {ThreadJob}
   * @private
   */
  this._job = null;

  /**
   * A cache to store information from the last job.
   *  
   * @type {object}
   * @private
   */
  this._cache = {};

  /**
   * The web worker to execute the job.
   * 
   * @type {Worker}
   * @private
   */
  this._worker;
  
  /**
   * The event mananger for this thread.
   * 
   * @private
   * @type {EventManager}
   */
  this._eventManager = new EventManager();
  
  /**
   * The configuration options for this thread.
   * 
   * @private
   * @type {object}
   */
  this._config;
};

/**
 * Enum for thread states.
 * 
 * @readonly
 * @enum {number}
 */
Thread.State = {
  
  /**
   * The thread has not yet startet.
   */
  NEW: 1,

  /**
   * The thread is free and ready to accept a new job.
   */
  FREE: 2,
  
  /**
   * The thread has been reserved for the execution of a new job and is 
   * currently set up.
   */
  SET_UP: 3,

  /**
   * The thread is running.
   */
  RUNNING: 4,

  /**
   * The thread has exited and can not be used anymore.
   */
  TERMINATED: 5

};
if(Object.freeze) {
  Object.freeze(Thread.State);
};

/**
 * Adds a new event listener to the thread. <br />
 * Supported events are:
 * <ul>
 * <li>
 * <b>statechange</b><br />
 * Will be called when the state changes.<br />
 * Example:<br />
 * <code>thread.addEventListener('statchange', function(oldState, 
 * newState) {...});</code>
 * </li>
 * </ul>
 * 
 * @param {string} type Event type.
 * @param {function} listener The listener to be called if the specified event
 * occurs.
 */
Thread.prototype.addEventListener = function addEventListener(type, listener) {
  this._eventManager.addEventListener(type, listener);
};

/**
 * Removes the given listener for the specified event type.<br />
 * If no event listener is given, all registered listeners for the
 * specified event will be removed.
 * @param {string} type The event type.
 * @param {function} [listener] The listener to be removed.
 */
Thread.prototype.removeEventListener = 
        function removeEventListener(type, listener) {
  this._eventManager.removeEventListener(type, listener);
};

/**
 * Processes incoming messages from the worker.
 * 
 * @private
 * @param {MessageEvent} event Das message event.
 */
Thread.prototype._onMessage = function _onMessage(event) {

  var msg = event.data;

  switch (msg.cmd) {
    case 'INIT':
      // Worker is initialised
      this._postSetup();
      break;
    case 'SET_UP':
      // Worker is set up
      this._postRun();
      break;
    case 'RESET':
      // Worker was reset
      this._postSetup();
      break;
    case 'RESOLVE':
      this._job._resolve(msg.result);
      this._job.triggerEvent(ThreadJob.EventType.SUCCESS, msg.result);
      this._job.triggerEvent(ThreadJob.EventType.DONE, msg.result);
      this._job.triggerEvent(ThreadJob.EventType.ALWAYS, msg.result);
      this._breakDown();
      break;
    case 'REJECT':
      var reason = msg.reason;
      if(reason.type && reason.type === 'error') {
        reason = new ErrorEvent('error', {
          message: reason.message,
          filename: reason.fileName,
          lineno: reason.lineNumber,
          colno: reason.columnNumber,
          error: null
        });
      }
      this._job.triggerEvent(ThreadJob.EventType.ERROR, reason);
      this._job.triggerEvent(ThreadJob.EventType.DONE, reason);
      this._job.triggerEvent(ThreadJob.EventType.ALWAYS, reason);
      this._breakDown();
      break;
    default:
      throw new Error('Unknown command: ' + msg.cmd);
  };
};

/**
 * Callback function that is called when an error occurs in the worker.
 * 
 * @private
 * @param {ErrorEvent} errorEvent Das error event.
 */
Thread.prototype._onError = function _onError(errorEvent) {
  this._job.triggerEvent(ThreadJob.EventType.ERROR, errorEvent);
  this._job.triggerEvent(ThreadJob.EventType.DONE, errorEvent);
  this._job.triggerEvent(ThreadJob.EventType.ALWAYS, errorEvent);
  this._breakDown();
};

/**
 * Sends a message to the worker.
 * 
 * @private
 * @param {*} msg The message that is sent to the
 * worker.
 */
Thread.prototype._postMessage = function _postMessage(msg) {
  if(this._worker) {
    this._worker.postMessage(msg);
  };
};

/**
 * Changes the state if this thead.
 * 
 * @private
 * @param {type} state The state to be set.
 */
Thread.prototype._changeState = function _changeState(state) {

  var oldState = this._state;
  this._state = state;
  
  var evt = {
    type: 'ThreadEvent',
    target: this,
    stateFrom: oldState,
    stateTo: state
  };
  this._eventManager.callEventListener('statechange', [evt]);
};

/**
 * Configures the thread. Threads can only be configured in state 'NEW'.
 * 
 * @param {object} cfg Thread configuration options.
 * @param {string} [cfg.evalWorkerUrl] Relative or absolute URL to the
 * eval worker script. Necessary for IE10/11 support.
 * @param {RequireJsConfig} [cfg.requirejs] Properties to load and set up
 * RequireJS.
 * @returns {Thread} The configured thread.
 */
Thread.prototype.config = function config(cfg) {
  if(this._state !== Thread.State.NEW) {
    throw new Error("Thread can only be configured in state 'NEW'");
  }
  this._config = cfg;
  return this;
};

/**
 * Creates and starts a new job. <br />
 * The thread is not automatically terminated after the execution of the job 
 * and can be reused. Should the thread not be used again, the function 
 * 'terminate()' should be called to free the resources.<br />
 * It must be passed a ThreadJob as parameter or the parameters to generate 
 * a new ThreadJob.
 * 
 * 
 * @param {ThreadJob} [job] The job to be executed.
 * @param {string} [name] The name of the new generated job.
 * @param {Array<string>} [dependencies] Relative or absolute URLs to scripts 
 * that should be imported into the worker.<br />
 * If RequireJS is configured for the Thread: Module names of modules that 
 * will be passed to the function of this job.
 * @param {ThreadFunction} [fn] The function to be executed.
 * @param {Array} [arguments] Arguments that will be passed to the function to 
 * be executed.
 * @return {ThreadJob} The newly created job or the job given as parameter.
 */
Thread.prototype.run = function run() {
  if(this._state !== Thread.State.NEW && this._state !== Thread.State.FREE) {
    throw new Error("Thread is not in state 'NEW' oder 'FREE'");
  } else {
    this._changeState(Thread.State.SET_UP);
    
    try {
      
      // Create and set job
      if(arguments.length === 1 && arguments[0] instanceof ThreadJob) {
        this._job = arguments[0];
      } else {

        // Add null to the beginning of the arguments array as 
        // 'thisArg'-parameter for 'apply()'
        Array.prototype.unshift.call(arguments, null);
        
        this._job = new (Function.prototype.bind.apply(ThreadJob, arguments));
      }
      runDeferred(this._runJob.bind(this));
      
    } catch(error) {
      this._breakDown();
      throw error;
    }
    return this._job;
  }
};

/**
 * Starts the current job.
 * 
 * @private
 */
Thread.prototype._runJob = function _runJob() {
  if(this._worker) {
    if(this._cache.fn === this._job.getFunction()) {
      // Reuse worker

      this._postRun();

    } else {
      // Reset worker
      this._cache = {};
      this._postReset();
    }
  } else {
    // Create new worker

    this._cache = {};
    
    if(isIE()) {
      // IE does not support web workers from object urls (causes 
      // SecurityError)
      if(this._config && this._config.evalWorkerUrl) {
        this._worker = new Worker(this._config.evalWorkerUrl);
        this._worker.postMessage(workerCode);
      } else {
        throw new Error('URL for eval-worker script not set');
      }
    } else {
      this._worker = new Worker(workerObjectURL);
    }
    
    this._worker.addEventListener(
      'message', 
      this._onMessage.bind(this), 
      false);
    this._worker.addEventListener('error', 
      this._onError.bind(this), 
      false);        

  }
};

/**
 * Sends the setup properties to the worker.
 * 
 * @private
 */
Thread.prototype._postSetup = function _postSetup() {
  if(this._state !== Thread.State.SET_UP) {
    throw new Error("Thread is not in state 'SET_UP'");
  }
  
  // If the worker is created from a blob URL it will be resolved with a
  // 'blob:' prefix while the app will be running from a differen (http(s)://)
  // scheme. Hence, import external scripts with realtive URLs will cause
  // an error. Therefore the worker must convert all relative URLs to absolute
  // URLs.
  var execLocation = {
    protocol: location.protocol,
    hostname: location.hostname,
    port: location.port,
    pathname: location.pathname
  };
  
  // Convert function to string
  var fnString = this._job.getFunction().toString();
  var fn = {
    params: fnString.substring(
            fnString.indexOf('(') + 1, fnString.indexOf(')')).split(','),
    body: fnString.substring(
            fnString.indexOf('{') + 1, fnString.lastIndexOf('}'))
  };
  
  var msg = {
    cmd: 'SET_UP',
    setup: {
      fn: fn,
      execLocation: execLocation
    }
  };
  if(this._config.requirejs) {
    msg.setup.requirejs = this._config.requirejs;
  }
  var dependencies = this._job.getDependencies();
  if(dependencies) {
    msg.setup.dependencies = dependencies;
  };
  this._postMessage(msg);
};

/**
 * Sends the command to run the job to the worker.
 * 
 * @private
 */
Thread.prototype._postRun = function _postRun() {
  this._changeState(Thread.State.RUNNING);
  this._job.triggerEvent(ThreadJob.EventType.START);
  var msg = {
    cmd: 'RUN'
  };
  
  var args = this._job.getArguments();
  if(args) {
    msg.args = args;
  }
  this._postMessage(msg);
};

/**
 * Sends the command to reset the worker.
 * 
 * @private
 */
Thread.prototype._postReset = function _postReset() {
  this._postMessage({cmd: 'RESET'});
};

/**
 * Break down the thread to reuse it with a new job.
 * 
 * @private
 */
Thread.prototype._breakDown = function _breakDown() {
  if(this._job && this._state > Thread.State.SET_UP) {
    this._cache.fn = this._job.getFunction();
  }
  this._job = null;
  this._changeState(Thread.State.FREE);
  
};

/**
 * Terminates the thread. The current job (if set) is killed immidiatly.
 * A terminated thread can not be used again.
 */
Thread.prototype.terminate = function terminate() {
  return new Promise(function(resolve, reject) {
    if(this._worker) {
      this._worker.terminate();
      this._worker = undefined;
    };
    if(this._job) {
      this._job.triggerEvent(
              ThreadJob.EventType.CANCELED, 
              'The thread was terminated');
      this._job.triggerEvent(ThreadJob.EventType.FINALLY);
    }
    this._changeState(Thread.State.TERMINATED);
    this._job = null;
    this._cache = {};
    resolve(undefined);
  }.bind(this));
};   

/**
 * Returns the current state of the thread.
 * 
 * @returns {Thread.State} Current state of the thread.
 */
Thread.prototype.getState = function getState() {
  return this._state;
};

/**
 * Returns the ID of this thread.
 * 
 * @returns {number} The id of this thread.
 */
Thread.prototype.getId = function getId() {
  return this._id;
};

/**
 * Return the current job of this thead.
 * 
 * @returns {ThreadJob|null} The current job or null if currently no job is set
 */
Thread.prototype.getJob = function getJob() {
  return this._job;
};

exports.Thread = Thread;