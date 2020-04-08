import { getState, updateState } from './state.js'
import * as data from './data.js'
import * as countries from './countries.js'
import * as functools from './lib/functools.js'
import * as string from './lib/string.js'

/* Search configuration */
const DELAY_DEBOUNCE_SEARCH = 200

export function init () {
  const countriesCodeMap = new Map()

  countries.forEach(function (c) {
    countriesCodeMap.set(c.code, c.country)
    countriesCodeMap.set(c.code.toLowerCase(), c.country)
  })

  const oninput = (e) => {
    const value = e.target.value

    if (value === '*') {
      const state = getState()
      const allCountriesSet = data.getCountries(state.dataset)
      const allCountriesOrdered = countries.getAll(state.countries, allCountriesSet)
      e.target.value = ''
      const update = { countries: Array.from(allCountriesOrdered).map(c => c.country) }
      updateState(update)
    } else if (value === '0') {
      e.target.value = ''
      updateState({ countries: [] })
    } else {
      const state = getState()
      const keys = [
        value,
        string.titlecase(value.toLowerCase()),
        string.capitalize(value.toLowerCase()),
        string.capitalizeFirstLetter(value.toLowerCase()),
        countriesCodeMap.get(value)
      ]

      for (const key of keys) {
        if (countries.getInfo(key) !== undefined) {
          const update = {}
          if (state.countries.includes(key)) {
            update.countries = state.countries.filter(
              (item) => item !== key
            )
          } else {
            update.countries = state.countries.concat([key])
          }
          e.target.value = ''
          updateState(update)
          break
        }
      }
    }
  }

  document.getElementById('search')
    .addEventListener(
      'input',
      functools.debounce(oninput, DELAY_DEBOUNCE_SEARCH)
    )

  document.getElementById('search')
    .addEventListener('keydown', (e) => e.stopPropagation())
}
