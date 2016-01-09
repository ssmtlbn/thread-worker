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