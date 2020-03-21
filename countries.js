"use strict";

const countries = (() => {
// Read mapping from Johns Hopkins country names to population.csv country names
  const NAME_MAPPING = {
    "Brunei": "Brunei Darussalam",
    "Congo (Kinshasa)": "Congo, Dem. Rep.",
    "Cruise Ship": null,
    "Czechia": "Czech Republic",
    "Egypt": "Egypt, Arab Rep.",
    "Eswatini": "Swaziland",
    "French Guiana": null,
    "Guadeloupe": null,
    "Guernsey": null,
    "Holy See": null,
    "Iran": "Iran, Islamic Rep.",
    "Jersey": null,
    "Korea, South": "Korea, Rep.",
    "Martinique": null,
    "North Macedonia": "Macedonia, FYR",
    "Reunion": null,
    "Russia": "Russian Federation",
    "Saint Lucia": "St. Lucia",
    "Saint Vincent and the Grenadines": "St. Vincent and the Grenadines",
    "Slovakia": "Slovak Republic",
    "Taiwan*": null,
    "US": "United States",
    "Venezuela": "Venezuela, RB",
    "occupied Palestinian territory": null,
  };

  const NAME_REVERSE_MAPPING = {};

  for ( const key in NAME_MAPPING ) {
    const value = NAME_MAPPING[key];
    if ( value === null ) continue ;
    NAME_REVERSE_MAPPING[value] = key;
  }

  const KEY_YEAR = "Year";
  const KEY_VALUE = "Value";
  const KEY_NAME = "Country Name";
  const KEY_CODE = "Country Code";

  const load = (year, names) => {
    const url = get_data_set_url();
    return new Promise(function (resolve, reject) {
      // Download and massage Johns Hopkins data
      const onreadystatechange = (event) => {
        if (event.target.readyState === XMLHttpRequest.DONE) {
          github.logRAWRequest(event);
          if (event.target.status === 200) {
            const raw = event.target.responseText ;
            let rows = d3.csvParse(raw);
            rows = sanitize(rows);
            if (year !== undefined) rows = select_year(year, rows);
            if (names !== undefined) rows = select_names(names, rows);
            rows = Array.from(rows);
            resolve(rows);
          }
        }
      };

      const request = new XMLHttpRequest();
      request.onreadystatechange = onreadystatechange ;
      request.open("GET", url);
      request.send();
    });
  } ;

  function* sanitize (rows) {
    for ( const old_row of rows ) {
      const new_row = {};
      for ( const column in old_row ) {
        if (column === KEY_YEAR) new_row[column] = parseInt(old_row[column], 10) ;
        else if (column === KEY_VALUE) new_row[column] = parseInt(old_row[column], 10) ;
        else if (column === KEY_NAME) {
          const name = old_row[column];
          new_row[column] = NAME_REVERSE_MAPPING[name] || name ;
        }
        else {
          new_row[column] = old_row[column];
        }
      }
      yield new_row;
    }
  }

  function select_year ( year, rows ) {
    return itertools.filter(row => row[KEY_YEAR] === year, rows);
  }

  function select_names ( names , rows ) {
    const name_set = new Set(names);
    return itertools.filter(row => name_set.has(row[KEY_NAME]), rows);
  }


  function* aggregate_by_country (rows) {

    const by_country = {} ;

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
  const SORT_BY_DATE = (a,b) => a[KEY_DATE] < b[KEY_DATE] ? -1 : a[KEY_DATE] > b[KEY_DATE] ? 1 : 0;

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

    const timeseries = [];

    for ( const datestring in by_date ) {
      timeseries.push(by_date[datestring]);
    }
    timeseries.sort(SORT_BY_DATE);
    return timeseries;
  } ;

    //const URL_TREE = GITHUB_API + "/repos/" + OWNER + "/" + REPO + "/git/trees/master?recursive=true" ;
    //const ROOT = "https://github.com/aureooms-research/pats-game-solutions/blob/master/" ;
    //const RAW = "https://raw.githubusercontent.com/aureooms-research/pats-game-solutions/master/" ;

    const get_data_set_url = () => {
      const owner = "datasets" ;
      const repo = "population" ;
      const path = `data/population.csv`;
      const url = github.raw_url(owner, repo, path);
      return url ;
    } ;


    return {
      load,
      KEY_NAME,
      KEY_CODE,
      KEY_VALUE,
    } ;

})();
