self.onmessage = function(e) {
   
  // Only the first message with worker code should be received by
  // this listener.
  self.onmessage = null;
  
  // Execute received code
  eval('(' + e.data + ')()');
};