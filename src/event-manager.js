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