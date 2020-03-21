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

  Object.keys(NAME_MAPPING).forEach(function(key) {
    const value = NAME_MAPPING[key];
    if ( ! (value === null) ) {
      NAME_REVERSE_MAPPING[value] = key;
    }
  });

  const KEY_YEAR = "Year";
  const KEY_VALUE = "Value";
  const KEY_NAME = "Country Name";
  const KEY_CODE = "Country Code";

  const load = (year, names) => {
    const url = get_data_set_url();
    return new Promise(function(resolve, reject) {
      // Download and massage population data
      const onreadystatechange = (event) => {
        if (event.target.readyState === XMLHttpRequest.DONE) {
          github.logRAWRequest(event);
          if (event.target.status === 200) {
            const raw = event.target.responseText;
            let rows = d3.csvParse(raw);
            rows = sanitize(rows);
            if (year !== undefined) rows = select_year(year, rows);
            if (names !== undefined) rows = select_names(names, rows);
            rows = Array.from(rows);
            validate(names, rows);
            resolve(rows);
          }
        }
      };

      const request = new XMLHttpRequest();
      request.onreadystatechange = onreadystatechange;
      request.open("GET", url);
      request.send();
    });
  };

  /** validates that all countries in names have been found
    * @param {List} names
    * @param {List} rows
    *
    * @return {Boolean}
    */
  function validate(names, rows) {
    let status = true;
    const foundNames = new Set(names);
    for (const country of rows) {
      if (! foundNames.has(country[KEY_NAME])) {
        console.log(country[KEY_NAME], "was not found in population data!");
        status = false;
      }
    }
    return status;
  }

  function* sanitize(rows) {
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

  function select_year(year, rows) {
    return itertools.filter((row) => row[KEY_YEAR] === year, rows);
  }

  function select_names(names, rows) {
    const name_set = new Set(names);
    return itertools.filter((row) => name_set.has(row[KEY_NAME]), rows);
  }


  const get_data_set_url = () => {
    const owner = "datasets";
    const repo = "population";
    const path = "data/population.csv";
    const url = github.raw_url(owner, repo, path);
    return url;
  };

  return {
    load,
    KEY_NAME,
    KEY_CODE,
    KEY_VALUE,
  };
})();
