/**
 * @param {*} predicate
 * @param {*} iterable
 */
export function* filter( predicate, iterable ) {
  for ( const item of iterable ) {
    if (predicate(item)) yield item;
  }
}

/**
 * @param {*} callable
 * @param {*} iterable
 */
export function* map( callable, iterable ) {
  for ( const item of iterable ) yield callable(item);
}
