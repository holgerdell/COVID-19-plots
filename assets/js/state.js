import * as hash from './lib/hash.js'
import * as defaults from './defaults.js'

export const getState = () => {
  const state = hash.get(defaults.state)
  console.debug(state)
  return state
}

export const updateState = (update) => hash.update(update)
