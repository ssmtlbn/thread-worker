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
  return this._queue.length;
};

/**
 * Checks if the thread pool has the capacity to immediatly (without to put
 * it the queue first) run a new job.
 * 
 * @returns {boolean} true if the pool can run a new job immediatly, false
 * otherwise.
 */
ThreadPool.prototype.isThreadAvailable = function isThreadAvailable() {
  return this._queue.length === 0
          && (
              this._threads.length < this._size 
              || (
                  this._threadsState[Thread.State.NEW].length > 0 
                  || this._threadsState[Thread.State.FREE].length > 0
                 )
             );
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