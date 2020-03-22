/**
 * @param {Function} fn
 * @param {Number} delay
 *
 * @return {Function}
 */
export function debounce( fn, delay ) {
  let timeoutId = null;
  return ( ...args ) => {
    if ( timeoutId !== null ) {
      window.clearTimeout( timeoutId );
    }
    timeoutId = window.setTimeout( fn, delay, ...args );
  };
}
