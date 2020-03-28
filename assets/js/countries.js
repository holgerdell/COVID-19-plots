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

/** Given the name of a country, returns its canonical name
 * (that is, the one we are going to display)
 * @param {String} country
 * @return {String}
 */
export function canonicalCountryName (country) {
  return NAME_MAPPING[country] || country
}

/* Variable (local to this module) that holds the population data */
let countries

export async function load (nameSet) {
  const URL = 'https://raw.githubusercontent.com/datasets/population/master/data/population.csv'
  let rows = await d3.csv(URL, sanitize)
  if (nameSet !== undefined) rows = selectNames(nameSet, rows)
  countries = itertools.group(rows, 'country')
  countries = selectLatestYear(countries)
}

export function forEach (f) {
  if (countries === undefined) {
    console.error('Must load data first')
    return
  }
  for (const e of Object.values(countries)) f(e)
}

export function getInfo (country) {
  if (countries === undefined) {
    console.error('Must load data first')
  } else if (countries[country] === undefined) {
    // console.debug(`Population data for ${country} is not available.`)
  } else {
    return countries[country]
  }
}

/** Return a list of all country entries.
 *
 * @param {List} first if defined, yield these countries first
 * @param {Set} restrict if defined, only yield countries from this set
 */
export function * getAll (first = [], restrict) {
  if (countries === undefined) {
    console.error('Must load data first')
  } else {
    for (const c of first) {
      yield countries[c]
    }
    first = new Set(first)
    const seq = (restrict !== undefined) ? restrict : Object.keys(countries)
    if (!first.has('World') && seq.has('World') && countries.World !== undefined) {
      yield countries.World
    }
    for (const c of seq) {
      if (!first.has(c) && c !== 'World' && countries[c] !== undefined) {
        yield countries[c]
      }
    }
  }
}

const KEY_YEAR = 'Year'
const KEY_VALUE = 'Value'
const KEY_NAME = 'Country Name'
const KEY_CODE = 'Country Code'

/** Sanitize a row of the population csv file
 * @param {Dictionary} row
 */
function sanitize (row) {
  return {
    country: canonicalCountryName(row[KEY_NAME]),
    code: row[KEY_CODE],
    population: parseInt(row[KEY_VALUE], 10),
    year: parseInt(row[KEY_YEAR], 10)
  }
}

function selectNames (nameSet, rows) {
  return itertools.filter((row) => nameSet.has(row.country), rows)
}

function selectLatestYear (countries) {
  for (const c of Object.keys(countries)) {
    let maxe = countries[c][0]
    for (const e of countries[c]) {
      maxe = (maxe.year > e.year) ? maxe : e
    }
    countries[c] = maxe
  }
  return countries
}

export function restrict (names) {
  const newCountries = {}
  for (const n of names) {
    if (countries[n] !== undefined) {
      newCountries[n] = countries[n]
    }
  }
  countries = newCountries
}
