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