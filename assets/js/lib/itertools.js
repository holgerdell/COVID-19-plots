export function* filter( predicate, iterable ) {
  for ( const item of iterable ) {
    if (predicate(item)) yield item;
  }
}

export function* map( callable, iterable ) {
  for ( const item of iterable ) yield callable(item);
}

export function* keys( object ) {
  // use Object.keys instead?
  for ( const key in object ) yield key;
}

export function* values( object ) {
  // use Object.values instead?
  for ( const key in object ) yield object[key];
}

export function* items( object ) {
  // use Object.entries instead?
  for ( const key in object ) yield [key, object[key]];
}
