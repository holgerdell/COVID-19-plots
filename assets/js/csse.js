"use strict";

const csse = (() => {
  const KEY_COUNTRY = "Country/Region";
  const KEY_STATE = "Province/State";
  const KEY_LATITUDE = "Lat";
  const KEY_LONGITUDE = "Long";
  const KEY_DATE = "Date";

  const TYPE_DEATHS = "Deaths";
  const TYPE_CONFIRMED = "Confirmed";
  const TYPE_RECOVERED = "Recovered";

  const types = [TYPE_DEATHS, TYPE_CONFIRMED, TYPE_RECOVERED] ;

  const load = (type) => {
    const url = get_data_set_url(type);
    return new Promise(function(resolve, reject) {
      // Download and massage Johns Hopkins data
      const onreadystatechange = (event) => {

        if (event.target.readyState === XMLHttpRequest.DONE) {
          github.logRAWRequest(event);
          if (event.target.status === 200) {
            const raw = event.target.responseText ;
            let rows = d3.csvParse(raw);
            rows = sanitize(rows);
            rows = aggregate_by_country(rows);
            rows = group_by_date(rows);
            resolve(rows);
          }
        }
      };

      const request = new XMLHttpRequest();
      request.onreadystatechange = onreadystatechange ;
      request.open("GET", url);
      request.send();
    });
  };

  function* sanitize(rows) {
    for ( const old_row of rows ) {
      const new_row = {};
      for ( const column in old_row ) {
        if (column === KEY_COUNTRY) new_row[column] = countries.canonicalCountryName(old_row[column]);
        else if (column === KEY_STATE) new_row[column] = old_row[column] ;
        else if (column === KEY_LATITUDE) new_row[column] = old_row[column] ;
        else if (column === KEY_LONGITUDE) new_row[column] = old_row[column] ;
        else {
          const [M,d,yy] = column.split("/");
          const dd = d.length === 1 ? "0"+d : d;
          const MM = M.length === 1 ? "0"+M : M;
          const yyyy = "20" + yy;
          const datestring = `${yyyy}-${MM}-${dd}`;
          new_row[datestring] = parseInt(old_row[column], 10);
        }
      }
      yield new_row;
    }
  } ;

  function* aggregate_by_country (rows) {
    const by_country = {};

    for ( const row of rows ) {
      const country = row[KEY_COUNTRY];
      if (by_country[country] === undefined) {
        by_country[country] = {} ;
        by_country[country][KEY_COUNTRY] = country;
      }

      const dates = by_country[country];

      for ( const column in row ) {
        if (column === KEY_COUNTRY) continue ;
        if (column === KEY_STATE) continue ;
        if (column === KEY_LATITUDE) continue ;
        if (column === KEY_LONGITUDE) continue ;
        if (dates[column] === undefined) {
          dates[column] = 0;
        }
        dates[column] += row[column];
      }
    }

    for ( const country in by_country ) {
      yield by_country[country];
    }
  } ;

  const KEY_FN_COUNTRY = (country, state, latitude, longitude) => country;
  const SORT_BY_DATE = (a, b) => a[KEY_DATE] < b[KEY_DATE] ? -1 : a[KEY_DATE] > b[KEY_DATE] ? 1 : 0;

  function group_by_date (rows, key_fn = KEY_FN_COUNTRY) {
    const by_date = {};
    for ( const row of rows ) {

      const country = row[KEY_COUNTRY];
      const state = row[KEY_STATE];
      const latitude = row[KEY_LATITUDE];
      const longitude = row[KEY_LONGITUDE];
      const key = key_fn(country, state, latitude, longitude);

      for ( const column in row ) {
        if (column === KEY_COUNTRY) continue ;
        if (column === KEY_STATE) continue ;
        if (column === KEY_LATITUDE) continue ;
        if (column === KEY_LONGITUDE) continue ;
        const datestring = column;
        if (by_date[datestring] === undefined) {
          by_date[datestring] = {} ;
          by_date[datestring][KEY_DATE] = datestring ;
        }
        by_date[datestring][key] = row[datestring];
      }
    }

    /* add world total */
    for ( const datestring in by_date ) {
      let world_total = 0;
      Object.keys(by_date[datestring]).forEach(function(key) {
        if (by_date[datestring][key] !== undefined && key !== KEY_DATE) {
          world_total += by_date[datestring][key];
        }
      });
      by_date[datestring]["World"] = world_total;
    }

    const timeseries = [];

    for ( const datestring in by_date ) {
      timeseries.push(by_date[datestring]);
    }
    timeseries.sort(SORT_BY_DATE);
    return timeseries;
  } ;

  const get_data_set_url = type => {
    const owner = "CSSEGISandData" ;
    const repo = "COVID-19" ;
    const path = `csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-${type}.csv`;
    const url = github.raw_url(owner, repo, path);
    return url ;
  } ;

  return {
    load,
    TYPE_DEATHS,
    TYPE_CONFIRMED,
    TYPE_RECOVERED,
    types,
    KEY_DATE,
    SORT_BY_DATE,
  } ;

})();
