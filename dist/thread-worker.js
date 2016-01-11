/*!
ThreadWorker v0.0.2 
(c) 2015 Samuel Samtleben 
License: MIT 
*/
(function(root, factory) { 
	if (typeof define === "function" && define.amd) {
		define(factory);
	} else if (typeof exports === "object") {
		module.exports = factory(); 
	} else { 
		root.threadWorker = factory();
	}
}(this, function () {
	var exports = {};
/**
 * Creates a new EventManager.
 * 
 * @constructs EventManager
 * @returns {EventManager} The newly created EventManager.
 */
function EventManager() {
  this._listener = {};
};

/**
 * Adds a new listener for the specified event type.
 * 
 * @param {string} type The event type.
 * @param {function} listener The listener which is called for the 
 * specified event.
 */
EventManager.prototype.addEventListener = 
        function addEventListener(type, listener) {

  if(!this._listener[type]) {
    this._listener[type] = [];
  };
  this._listener[type].push(listener);
};

/**
 * Removes the given listener for the specified event type.<br />
 * If no event listener is given, all registered listeners for the
 * specified event will be removed.
 * @param {string} type The event type.
 * @param {function} [listener] The listener to be removed.
 */
EventManager.prototype.removeEventListener = 
        function removeEventListener(type, listener) {
          
  if(this._listener[type]) {     
    if(!listener) {
      this._listener[type] = [];
    } else {
      var i = this._listener[type].length;
      while(i--) {
        if(this._listener[type][i] === listener) {
          this._listener[type].splice(i, 1);
        }
      }
    }
  }
};

/**
 * Calls the registered listeners for the specified event type.
 * 
 * @param {string} type The event type.
 * @param {Array} [args] The arguments which will be passed to the listeners.
 * @param {boolean} [async=true] Specifies wether the listeners should be
 * called asynchronously.
 */
EventManager.prototype.callEventListener = 
        function callEventListener(type, args, async) {

  if(async === undefined) {
    async = true;
  }
  if(this._listener[type]) {
    this._listener[type].forEach(function(listener) {
      if(async) {
        setTimeout(function() {
          listener.apply(null, args);
        }, 0);
      } else {
        listener.apply(null, args);
      };
    });
  };    
};

exports.EventManager = EventManager;
/**
 * Creates a new ThreadJob.
 * 
 * @constructor
 * @param {string} [name] The name of the job.
 * @param {string[]} [dependencies] Relative or absolute URLs to scripts 
 * that should be imported into the worker. <br />
 * If RequireJS is configured for the Thread: Module names of modules that
 * will be passed to the function of this job.
 * @param {ThreadFunction} fn The function to be executed.
 * @param {Array} [arguments] Arguments that will be passed to the function to 
 * be executed.
 * @returns {ThreadJob} The newly created ThreadJob.
 */
function ThreadJob(fn) {

  /**
   * The name of this job.
   * 
   * @private
   * @type {?string}
   */
  this._name = null;

  /**
   * Dependencies of the function of this job.
   * @private
   * @type {?string[]}
   */
  this._dependencies = null;

  /**
   * The function to be executed.
   * 
   * @private
   * @type {ThreadFunction}
   */
  this._function = null;

  /**
   * Arguments of the function to be executed.
   * 
   * @private
   * @type {Array}
   */
  this._arguments = null;

  /**
   * The EventManager for this job.
   * 
   * @private
   * @type {EventManager}
   */
  this._eventManager = new EventManager();
  
  /**
   * The Promise of this job.
   * 
   * @type {Promise}
   */
  this.promise = undefined;
  
  /**
   * The resolve function of the promise of this job.
   * 
   * @private
   * @type {function}
   */
  this._resolve = undefined;
  
  /**
   * The reject function of the promise of this job.
   * 
   * @private
   * @type {function}
   */
  this._reject = undefined;

  // Parse arguments
  // ----------------------------------------------------------------------

  if(arguments.length < 1) {
    throw new Error('Too few arguments.');
  } else if(arguments.length > 4) {
    throw new Error('Too many arguments.');
  } else {
    var args = Array.prototype.slice.call(arguments);
    
    // Process name if available
    if(args.length > 1 && typeof args[0] === "string") {
      this._name = args.shift();
    };
    
    if(args.length > 1 && args[0] instanceof Array) {
      // Argument is an Array, must be the dependencies
      this._dependencies = args.shift();
    };

    // Name and dependencies processed, now the function must follow
    if(args.length > 0 && args[0] instanceof Function) {
      this._function = args.shift();
    } else {
      throw new Error('Function is missing');
    };
    
    // Process data arguments
    if(args.length > 0) {
      this._arguments = args.shift();
    };
    
    this.promise = new Promise(function(resolve, reject) {
      this._resolve = resolve;
      this._reject = reject;
    }.bind(this));

  }

};

/**
 * Enum for event types.
 * 
 * @readonly
 * @enum {number}
 */
ThreadJob.EventType = {

  /** Job started. */
  START: 0,

  /** Job has generated output. */
  PROCESS: 1,

  /** Job completed successfully. */
  SUCCESS: 2,
  
  /** Processing of the job failed. */
  ERROR: 3,
  
  /** Job is finished (success or error). */
  DONE: 4,

  /** Processing of the job has been cancelled. */
  CANCELED: 5,
  
  /** Job has been completed (success or error) or canceled. */
  FINALLY: 6
  
};
if(Object.freeze) {
  Object.freeze(ThreadJob.EventType);
};

/**
 * Returns the name of this job.
 * 
 * @returns {string|null} Name of this job or null if no name specified.
 */
ThreadJob.prototype.getName = function getName() {
  return this._name;
};

/**
 * Returns the dependencies of this job.
 * 
 * @returns {string[]|null} Dependencies of this job or null if no
 * dependencies specified.
 */
ThreadJob.prototype.getDependencies = function getDependencies() {
  return this._dependencies;
};

/**
 * Returns the function to be executed.
 * 
 * @returns {ThreadFunction} The function to be executed.
 */
ThreadJob.prototype.getFunction = function getFunction() {
  return this._function;
};

/**
 * Returns the additional data arguments of the function to be executed.
 * 
 * @returns {Array|null} Argumens or null if no arguments specified.
 */
ThreadJob.prototype.getArguments = function getArguments() {
  return this._arguments;
};

/**
 * Triggers an event with the given type and calls the registered listeners
 * for the event type.
 * 
 * @param {string} type Event type.
 * @param {*} [eventData] Data that will be passed to the listeners as 
 * arguments.
 */
ThreadJob.prototype.triggerEvent = 
        function triggerEvent(type, eventData) {
          
  this._eventManager.callEventListener(type, [eventData]);
  
  if(type === ThreadJob.EventType.SUCCESS) {
    if(this._resolve) {
      this._resolve(eventData);
    }
  } else if (type === ThreadJob.EventType.ERROR 
          || type === ThreadJob.EventType.CANCELED) {
    if(this._reject) {
      this._reject(eventData);
    }
  }
};

/**
 * Adds a callback function that is called when the processing of the
 * job was started.
 * 
 * @param {function} callback Callback function
 * @returns {ThreadJob} This job.
 */
ThreadJob.prototype.start = function start(callback) {
  this._eventManager.addEventListener(ThreadJob.EventType.START, callback);
  return this;
};

/**
 * Adds a callback function that is called when the job has generated
 * output.
 * 
 * @param {function} callback Callback function
 * @returns {ThreadJob} This job.
 */
ThreadJob.prototype.process = function output(callback) {
  this._eventManager.addEventListener(ThreadJob.EventType.PROCESS, callback);
  return this;
};  


/**
 * Adds a callback function that is called when the job was completed
 * successfully.
 * 
 * @param {function} callback Callback function
 * @returns {ThreadJob} This job.
 */
ThreadJob.prototype.success = function success(callback) {
  this._eventManager.addEventListener(ThreadJob.EventType.SUCCESS, callback);
  return this;
};

/**
 * Adds a callback function that is called when the processing of the job
 * failed.
 * 
 * @param {function} callback Callback function
 * @returns {ThreadJob} This job.
 */
ThreadJob.prototype.error = function error(callback) {
  this._eventManager.addEventListener(ThreadJob.EventType.ERROR, callback);
  return this;
};

/**
 * Adds a callback function that is called when the job was completed (success
 * or error).
 * 
 * @param {function} callback Callback function
 * @returns {ThreadJob} This job.
 */
ThreadJob.prototype.done = function done(callback) {
  this._eventManager.addEventListener(ThreadJob.EventType.DONE, callback);
  return this;
};

/**
 * Adds a callback function that is called when the job was canceled.
 * 
 * @param {function} callback Callback function
 * @returns {ThreadJob} This job.
 */
ThreadJob.prototype.canceled = function canceled(callback) {
  this._eventManager.addEventListener(ThreadJob.EventType.CANCELED, callback);
  return this;
};

/**
 * Adds a callback function that is called when the job was completed (success 
 * or error) or cancelled.
 * 
 * @param {function} callback Callback function
 * @returns {ThreadJob} This job.
 */
ThreadJob.prototype.finally = function _finally(callback) {
  this._eventManager.addEventListener(ThreadJob.EventType.FINALLY, callback);
  return this;
};

exports.ThreadJob = ThreadJob;
/**
 * Creates a new thread pool.
 * 
 * @constructor
 * @returns {ThradPool} The newly created thread pool.
 */
function ThreadPool() {

  /**
   * The size of the thread pool (number of threads).
   * 
   * @private
   * @type {number}
   */
  this._size = 0;
  
  /**
   * Contains all threads.
   * 
   * @private
   * @type {Array<Thread>}
   */
  this._threads = [];

  /**
   * Contains all threads, grouped by their state.
   * 
   * @private
   * @type {Object<Thread.State, Array<Thread>>}
   */
  this._threadsState = {};

  /**
   * The queue for jobs to be executed.
   * 
   * @private
   * @type {ThreadJob}
   */
  this._queue = [];

  /**
   * The state of the thread pool.
   * 
   * @private
   * @type {ThreadPool.State}
   */
  this._state = ThreadPool.State.NEW;
  
  /**
   * Configuration options for new threads.
   * 
   * @private
   * @type {object}
   */
  this._threadConfig = null;
  
  
  // Initialize object to hold threads
  Object.keys(Thread.State).forEach((function(key, index, states) {
    this._threadsState[Thread.State[key]] = [];
  }), this);  
  
};

/**
 * Enum for thread pool states.
 * 
 * @readonly
 * @enum {number}
 */
ThreadPool.State = {
  
  /**
   * The thread pool has not yet started.
   */
  NEW: 0,
  
  /**
   * The thread pool is running.
   */
  RUNNING: 1,

  /**
   * The thead pool is paused.
   * 
   */
  PAUSED: 2
};
if(Object.freeze) {
  Object.freeze(ThreadPool.State);
};

/**
 * Configures the thread pool.
 * 
 * @param {object} cfg Configuration options.
 * @param {number} [cfg.size] The size of the thread pool (number of threads).
 * @param {object} [cfg.thread] The configuration options for new threads.
 * See {@link Thread#config} for thread configuration options.
 * @returns {ThreadPool} The configured thread pool.
 * 
 */
ThreadPool.prototype.config = function init(cfg) {
  if(this._state !== ThreadPool.State.NEW) {
    throw new Error("Thread pool can only be configured in state 'NEW'");
  }
  if(cfg.size) {
    if(isNaN(cfg.size)) {
      throw new Error("'size' is not a number");
    } else {
      this._size = cfg.size;
    }
  }
  if(cfg.thread) {
    this._threadConfig = cfg.thread;
  }
  return this;
};

/**
 * Creates and adds a new job.
 * 
 * @param {string} [name] The name of the new generated job.
 * @param {Array<string>} [dependencies] Relative or absolute URLs to scripts 
 * that should be imported into the worker.<br />
 * If RequireJS is configured for the Thread: Module names of modules that 
 * will be passed to the function of this job.
 * @param {ThreadFunction} fn The function to be executed.
 * @param {Array} [arguments] Arguments that will be passed to the function to 
 * be executed.
 * @returns {ThreadJob} The newly created job.
 */
ThreadPool.prototype.run = function run(fn) {
  if(this._size === 0) {
    throw new Error(
            'Pool size is 0. Use configure() to set a size greater then 0.');
  }
  
  Array.prototype.unshift.call(arguments, null);
  var job = new (Function.prototype.bind.apply(ThreadJob, arguments));
  
  this._state = ThreadPool.State.RUNNING;
  this._queue.push(job);
  runDeferred(this._manageThreads.bind(this));
  return job;
};

/**
 * Manages the execution of the threads.
 * 
 * @private
 */
ThreadPool.prototype._manageThreads = function _manageThreads() {
  // Check if pool is running, otherwise do nothing
  if(this._state === ThreadPool.State.RUNNING && this._queue.length > 0) {
    
    // Search free or new thread
    var thread;
    if(this._threadsState[Thread.State.FREE].length > 0) {
      thread = this._threadsState[Thread.State.FREE].pop();
      
    } else if (this._threadsState[Thread.State.NEW].length > 0) {
      thread =  this._threadsState[Thread.State.NEW].pop();
      
    } else if(this._threads.length < this._size) {
      thread = new Thread();
      this._threads.push(thread);
      if(this._threadConfig) {
        thread.config(this._threadConfig);
      };
      
      thread.addEventListener('statechange', function(evt) {
               
        // It is possible that the thread is currently not in any array of
        // the '_threadState'-object. When a new job is started, the thread
        // is removed from the '_threadState'-object and added back when the
        // 'statechange' listener is called.
        var threadIndex = this._threadsState[evt.stateFrom].indexOf(evt.target);
        if(threadIndex > -1) {
          this._threadsState[evt.stateFrom].splice(threadIndex, 1);
        };
        
        if(evt.stateTo !== Thread.State.TERMINATED) {
          this._threadsState[evt.stateTo].push(evt.target);
        } else {
          threadIndex = this._threads.indexOf(evt.target);
          if(threadIndex > -1) {
            this._threads.splice(threadIndex, 1); 
          }
        };
        runDeferred(this._manageThreads.bind(this));      
        
      }.bind(this));
    };
    
    if(thread) {
      thread.run(this._queue.shift());
    }
  };
};

/**
 * Cancels all jobs with the given name.
 * If the job is currently executed in a thread, the thread will be 
 * terminated. Jobs from the queue will be removed.
 * 
 * @param {string} name The name of the jobs to be canceled.
 */
ThreadPool.prototype.cancelJob = function cancelJob(name) {
  if(!name) {
    throw new Error('Name not specified');
  };
  
  var i = this._queue.length;
  while(i--) {
    if(this._queue[i].getName() === name) {
      var job = this._queue.splice(i, 1)[0];
      job.triggerEvent(ThreadJob.EventType.CANCELED, 'The job was canceled');
      job.triggerEvent(ThreadJob.EventType.FINALLY);
    }
  };
  
  i = this._threads.length;
  while(i--) {
    var job = this._threads[i].getJob();
    if(job && job.getName() === name) {
      this._threads[i].terminate();
    }
  };
};

/**
 * Cancels all jobs. Threads currently executing a job will be terminated.
 * Jobs in the queue will be removed.
 */
ThreadPool.prototype.cancelAllJobs = function cancelAllJobs() {
  var jobs = this._queue.slice(0, this._queue.length);
  
  for(var i = 0; i < jobs.length; i++) {
    jobs[i].triggerEvent(ThreadJob.EventType.CANCELED, 'The job was canceled');
    jobs[i].triggerEvent(ThreadJob.EventType.FINALLY);
  };
  
  for(var i = 0; i < this._threads.length; i++) {
    this._threads[i].terminate();
  }
};

/**
 * Terminates the thread with the given ID. If no thread with the given
 * ID is found an error will be thrown.
 * 
 * @param {number} threadId The id of the thread to be terminated.
 */
ThreadPool.prototype.terminate = function terminate(threadId) {
  var terminated = false;
  var i = this._threads.length;
  
  while(!terminated && i--) {
    if(this._threads[i].getId() === threadId) {
      this._threads[i].terminate();
      terminated = true;
    };
  };
};

/**
 * Terminates all threads. Jobs in the queue will NOT be removed.
 */
ThreadPool.prototype.terminateAll = function terminateAll() {
  for(var i = 0; i < this._threads.length; i++) {
    this._threads[i].terminate();
  };
};

/**
 * Clears the job queue. <br />
 * Does NOT call any listeners of the jobs.
 */
ThreadPool.prototype.clearQueue = function clearQueue() {
  this._queue = [];
};

/**
 * Returns the current size of the queue.
 * 
 * @returns {mumber} Current size of the queue.
 */
ThreadPool.prototype.getQueueSize = function getQueueSize() {
  return this._jobQueue.length;
};

/**
 * Checks if the thread pool has the capacity to immediatly (without to put
 * it the queue first) run a new job.
 * 
 * @returns {boolean} true if the pool can run a new job immediatly, false
 * otherwise.
 */
ThreadPool.prototype.isThreadAvailable = function isThreadAvailable() {
  return this._queue.length === 0 && this._threads.length < this._size;
};

/**
 * Pauses the thread pool so that no new thrads will be started.
 * Currently running threads will NOT be terminated.
 */
ThreadPool.prototype.pause = function pause() {
  this._state = ThreadPool.State.PAUSED;
};

/**
 * Resumes the paused thread pool.
 */
ThreadPool.prototype.resume = function resume() {
  if(this._state === ThreadPool.State.PAUSED) {
    
    this._state = ThreadPool.State.RUNNING;
    runDeferred(this._manageThreads.bind(this));
  };
};

exports.ThreadPool = ThreadPool;

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
      if(rjsConf.config) {
        require.config(rjsConf.config);
      }

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

      // remove filename or empty string
      baseParts.pop();

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
              + execLocation.port + baseParts.join('/');
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
 * @property {string} [dataMain] Relative or absolute URL to a data-main script. 
 * You will typically use a data-main script to set configuration options. It 
 * is executed diretly after RequireJS has been loaded. See 
 * {@link http://requirejs.org/docs/api.html#data-main} for more
 * information about data-main script.
 * @property {object} config RequireJS configuration options. The configuration 
 * options will be set after the data-main script is executed (if specified). 
 * See {@link http://requirejs.org/docs/api.html#config} for more
 * information about the configuration options.
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
/**
 * Runs the given function deferred.
 * 
 * @param {function} fn The function to run.
 */
function runDeferred(fn) {
  setTimeout(fn, 0);
}
exports.runDeferred = runDeferred;

/**
 * Checks if the current browser is IE.
 * 
 * @returns {boolean} true if current browser is IE, false otherwise
 */
function isIE() {
  return (navigator.userAgent.indexOf('MSIE ') !== -1) 
          || (navigator.userAgent.indexOf('Trident/') !== -1);
}
exports.isIE = isIE;
return exports;
}));
//# sourceMappingURL=thread-worker.js.map