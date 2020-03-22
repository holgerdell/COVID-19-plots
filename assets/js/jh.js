import * as countries from "./countries.js";

export const KEY_COUNTRY = "Country/Region";
export const KEY_STATE = "Province/State";
export const KEY_LATITUDE = "Lat";
export const KEY_LONGITUDE = "Long";
export const KEY_DATE = "Date";

export const TYPE_DEATHS = "Deaths";
export const TYPE_CONFIRMED = "Confirmed";
export const TYPE_RECOVERED = "Recovered";

export const types = [TYPE_DEATHS, TYPE_CONFIRMED, TYPE_RECOVERED];


export const load = (type) => {
  const URL = `https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-${type}.csv`;
  return new Promise(function(resolve, reject) {
    d3.csv(URL).then(function(rows) {
      rows = sanitize(rows);
      rows = aggregateByCountry(rows);
      rows = groupByDate(rows);
      resolve(rows);
    });
  });
};

/**
 * @param {List} rows
 */
function* sanitize(rows) {
  for ( const row of rows ) {
    const newrow = {};
    for ( const column in row ) {
      if (column === KEY_COUNTRY) {
        newrow[column] = countries.canonicalCountryName(row[column]);
      } else if (column === KEY_STATE) newrow[column] = row[column];
      else if (column === KEY_LATITUDE) newrow[column] = row[column];
      else if (column === KEY_LONGITUDE) newrow[column] = row[column];
      else {
        const [M, d, yy] = column.split("/");
        const dd = d.length === 1 ? "0"+d : d;
        const MM = M.length === 1 ? "0"+M : M;
        const yyyy = "20" + yy;
        const datestring = `${yyyy}-${MM}-${dd}`;
        newrow[datestring] = parseInt(row[column], 10);
      }
    }
    yield newrow;
  }
}

/**
 * @param {List} rows
 */
function* aggregateByCountry(rows) {
  const byCountry = {};

  for ( const row of rows ) {
    const country = row[KEY_COUNTRY];
    if (byCountry[country] === undefined) {
      byCountry[country] = {};
      byCountry[country][KEY_COUNTRY] = country;
    }

    const dates = byCountry[country];

    for ( const column in row ) {
      if (column === KEY_COUNTRY) continue;
      if (column === KEY_STATE) continue;
      if (column === KEY_LATITUDE) continue;
      if (column === KEY_LONGITUDE) continue;
      if (dates[column] === undefined) {
        dates[column] = 0;
      }
      dates[column] += row[column];
    }
  }

  for ( const row of Object.values(byCountry) ) {
    yield row;
  }
}

const KEY_FN_COUNTRY = (country, state, latitude, longitude) => country;
const SORT_BY_DATE =
  (a, b) => a[KEY_DATE] < b[KEY_DATE] ? -1 : a[KEY_DATE] > b[KEY_DATE] ? 1 : 0;

/**
 * @param {List} rows
 * @param {Function} key_fn
 *
 * @return {List}
 */
function groupByDate(rows, key_fn = KEY_FN_COUNTRY) {
  const byDate = {};
  for ( const row of rows ) {
    const country = row[KEY_COUNTRY];
    const state = row[KEY_STATE];
    const latitude = row[KEY_LATITUDE];
    const longitude = row[KEY_LONGITUDE];
    const key = key_fn(country, state, latitude, longitude);

    for ( const column in row ) {
      if (column === KEY_COUNTRY) continue;
      if (column === KEY_STATE) continue;
      if (column === KEY_LATITUDE) continue;
      if (column === KEY_LONGITUDE) continue;
      const datestring = column;
      if (byDate[datestring] === undefined) {
        byDate[datestring] = {};
        byDate[datestring][KEY_DATE] = datestring;
      }
      byDate[datestring][key] = row[datestring];
    }
  }

  /* add world total */
  Object.keys(byDate).forEach(function(datestring) {
    let worldTotal = 0;
    Object.keys(byDate[datestring]).forEach(function(key) {
      if (byDate[datestring][key] !== undefined && key !== KEY_DATE) {
        worldTotal += byDate[datestring][key];
      }
    });
    byDate[datestring]["World"] = worldTotal;
  });

  const timeseries = Object.values(byDate);
  timeseries.sort(SORT_BY_DATE);
  return timeseries;
}
