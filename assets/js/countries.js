import * as itertools from './lib/itertools.js'

// Map country names from different sources to the display names on the right
const NAME_MAPPING = {
  Brunei: 'Brunei Darussalam',
  'Congo (Kinshasa)': 'Democratic Republic of the Congo',
  'Congo, Dem. Rep.': 'Democratic Republic of the Congo',
  'Democratic Republic of Congo': 'Democratic Republic of the Congo',
  Czechia: 'Czech Republic',
  'Gambia, The': 'The Gambia',
  Gambia: 'The Gambia',
  'Egypt, Arab Rep.': 'Egypt',
  Eswatini: 'Swaziland',
  'Iran, Islamic Rep.': 'Iran',
  'Bahamas, The': 'The Bahamas',
  Bahamas: 'The Bahamas',
  'Korea, Rep.': 'South Korea',
  'Korea, South': 'South Korea',
  'Macedonia, FYR': 'North Macedonia',
  Macedonia: 'North Macedonia',
  'Russian Federation': 'Russia',
  'Saint Lucia': 'St. Lucia',
  'Saint Vincent and the Grenadines': 'St. Vincent and the Grenadines',
  Slovakia: 'Slovak Republic',
  US: 'United States',
  'Venezuela, RB': 'Venezuela'
}

export const KEY_YEAR = 'Year'
export const KEY_VALUE = 'Value'
export const KEY_NAME = 'Country Name'
export const KEY_CODE = 'Country Code'

export const load = (year, names) => {
  const URL = 'https://raw.githubusercontent.com/datasets/population/master/data/population.csv'
  return new Promise(function (resolve, reject) {
    d3.csv(URL).then(function (rows) {
      rows = sanitize(rows)
      if (year !== undefined) rows = selectYear(year, rows)
      if (names !== undefined) rows = selectNames(names, rows)
      rows = Array.from(rows)
      validate(names, rows)
      resolve(rows)
    })
  })
}

/** validates that all countries in names have been found
  * @param {List} names
  * @param {List} rows
  *
  * @return {Boolean}
  */
function validate (names, rows) {
  const foundNames = new Set()
  for (const row of rows) {
    foundNames.add(row.country)
  }
  let status = true
  const notFound = new Set()
  for (const name of names) {
    if (!foundNames.has(name)) {
      status = false
      notFound.add(name)
    }
  }
  console.log('Info: These country names were not found in population data:',
    Array.from(notFound))
  return status
}

/**
 * @param {List} rows
 */
function * sanitize (rows) {
  for (const row of rows) {
    yield {
      country: canonicalCountryName(row[KEY_NAME]),
      code: row[KEY_CODE],
      population: parseInt(row[KEY_VALUE], 10),
      year: parseInt(row[KEY_YEAR], 10)
    }
  }
}

const selectYear = function (year, rows) {
  return itertools.filter((row) => row.year === year, rows)
}

const selectNames = function (names, rows) {
  const set = new Set(names)
  return itertools.filter((row) => set.has(row.country), rows)
}

/** Given the name of a country, returns its canonical name
 * (that is, the one we are going to display)
 * @param {String} country
 * @return {String}
 */
export function canonicalCountryName (country) {
  return NAME_MAPPING[country] || country
}
