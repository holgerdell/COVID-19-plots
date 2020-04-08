/* This module is the interface between main.js and the time-series data. */

import * as jh from './data_jh.js'
import * as owid from './data_owid.js'

/* This dict holds the available time series data
 * (it is filled on-demand, so we don't re-fetch remote data and we only fetch it when needed). */
const timeSeriesData = {}
/* For example, timeSeriesData['owid_total_cases']['Germany']['2020-03-28'] is an "entry".
Each entry is a dict of the form
{
  country: xxx,
  datestring: 'yyyy-mm-dd',
  dates: <Date object>,
  value: xxx,
  normalized_value: xxx,
  source: 'owid_total_cases'
}
*/
const errorDatasets = new Set() // datasets that failed to be fetched. Don't re-fetch them

/**
 *
 * @param {String} dataset the dataset we wish to fetch
 * @return {Boolean} true iff the dataset is now available
 */
export async function fetchTimeSeriesData (dataset) {
  if (timeSeriesData[dataset] === undefined && !errorDatasets.has(dataset)) {
    const source = dataset.split('_')[0]
    let rows
    if (source === 'owid') {
      rows = await owid.load()
    } else if (source === 'jh') {
      const type = dataset.substring(source.length + 1)
      rows = await jh.load(type)
    } else {
      console.error(`Dataset ${dataset} not available`)
      rows = []
    }
    rows = parseDate(rows)
    for (const row of rows) {
      if (dataset.split('_')[0] !== row.source.split('_')[0]) {
        console.error(`Requested ${dataset} but got ${row.source}`)
      }
      if (timeSeriesData[row.source] === undefined) timeSeriesData[row.source] = {}
      if (timeSeriesData[row.source][row.country] === undefined) timeSeriesData[row.source][row.country] = {}
      timeSeriesData[row.source][row.country][row.datestring] = row
    }
  }
  if (timeSeriesData[dataset] === undefined) {
    errorDatasets.add(dataset)
    return false
  } else {
    return true
  }
}

function * parseDate (rows) {
  for (const row of rows) {
    row.date = d3.timeParse('%Y-%m-%d')(row.datestring)
    yield row
  }
}

/** This function returns an entry from the time series data
  * @param {String} datestring the date we're interested in
  * @param {String} country the country we're interested in
  * @param {String} dataset the dataset we're interested in
  * @param {Boolean} normalize divide by population size or not?
  *
  * @return {Dict} the entry
  */
export async function getValue (datestring, country, dataset) {
  if (await fetchTimeSeriesData(dataset)) {
    return timeSeriesData[dataset][country][datestring]
  }
}

/** This function returns a sequence of entries, sorted by date
  * @param {String} country the country we're interested in
  * @param {String} dataset the dataset we're interested in
  *
  * @return {List} of entries
  */
export function getTimeSeries (country, dataset) {
  if (timeSeriesData[dataset] === undefined || timeSeriesData[dataset][country] === undefined) {
    return []
  } else {
    const ts = timeSeriesData[dataset][country]
    const rows = Object.values(ts)
    rows.sort((a, b) => a.date - b.date)
    return rows
  }
}

/** Return all available datasets
  * @return {List} of Strings
  */
export function availableDatasets () {
  return jh.types.map((x) => `jh_${x}`)
    .concat(owid.types.map((x) => `owid_${x}`))
}

export const defaultDataset = 'owid_' + owid.TYPE_DEATHS

export function describe (dataset) {
  if (dataset === 'jh_' + jh.TYPE_CONFIRMED || dataset === 'owid_' + owid.TYPE_CASES) {
    return 'Confirmed Infections'
  } else if (dataset === 'jh_' + jh.TYPE_DEATHS || dataset === 'owid_' + owid.TYPE_DEATHS) {
    return 'Confirmed Deaths'
  } else if (dataset === 'jh_' + jh.TYPE_RECOVERED) {
    return 'Confirmed Recovered'
  }
}

export function * allEntries () {
  for (const d of Object.keys(timeSeriesData)) {
    for (const c of Object.keys(timeSeriesData[d])) {
      for (const ds of Object.keys(timeSeriesData[d][c])) {
        yield timeSeriesData[d][c][ds]
      }
    }
  }
}

export function getCountries (dataset) {
  return new Set(Object.keys(timeSeriesData[dataset]))
}
