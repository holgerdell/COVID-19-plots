import { merge } from './object.js'

export function get (...defaults) {
  const hash = decodeURIComponent(window.location.hash.substr(1))

  try {
    const parsed = JSON.parse(hash)
    return merge({}, ...defaults, parsed)
  } catch (e) {
    console.debug('could not parse hash', hash)
    console.debug('outputting defaults', ...defaults)
    return merge({}, ...defaults)
  }
}

export function set (object) {
  window.location.hash = encode(object)
}

export function update (object) {
  set(merge(get(), object))
}

export function encode (object) {
  return '#' + encodeURIComponent(JSON.stringify(object))
}
