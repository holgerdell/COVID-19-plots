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

/**
 * @param {*} iterable1
 * @param {*} iterable2
 */
export function* concat(iterable1, iterable2) {
  for ( const item of iterable1 ) yield item;
  for ( const item of iterable2 ) yield item;
}


/** Add field and value to each row
 * @param {List} rows
 * @param {List} field
 * @param {List} value
 */
export function* addField(rows, field, value) {
  for ( const row of rows ) {
    row[field] = value;
    yield row;
  }
}

/** Group a list of rows into a dictionary addressed by column key
 * @param {List} rows
 * @param {String} key column by which to group
 *
 * @return {Dictionary}
 */
export function group(rows, key) {
  const groups = {};
  for ( const row of rows ) {
    if (row[key] !== undefined) {
      if (groups[row[key]] === undefined) {
        groups[row[key]] = [];
      }
      groups[row[key]].push(row);
    }
  }
  return groups;
}
