"use strict";

const countries = (() => {
// Map country names from different sources to the display names on the right
  const NAME_MAPPING = {
    "Brunei": "Brunei Darussalam",
    "Congo (Kinshasa)": "Democratic Republic of the Congo",
    "Congo, Dem. Rep.": "Democratic Republic of the Congo",
    "Czechia": "Czech Republic",
    "Gambia, The": "The Gambia",
    "Egypt, Arab Rep.": "Egypt",
    "Eswatini": "Swaziland",
    "Iran, Islamic Rep.": "Iran",
    "Bahamas, The": "The Bahamas",
    "Korea, Rep.": "South Korea",
    "Korea, South": "South Korea",
    "Macedonia, FYR": "North Macedonia",
    "Russian Federation": "Russia",
    "Saint Lucia": "St. Lucia",
    "Saint Vincent and the Grenadines": "St. Vincent and the Grenadines",
    "Slovakia": "Slovak Republic",
    "US": "United States",
    "Venezuela, RB": "Venezuela",
  };

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
          new_row[column] = canonicalCountryName(name);
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

  /** Given the name of a country, returns its canonical name
   * (that is, the one we are going to display)
   * @param {String} country
   * @return {String}
   */
  function canonicalCountryName(country) {
    return NAME_MAPPING[country] || country;
  }

  return {
    load,
    KEY_NAME,
    KEY_CODE,
    KEY_VALUE,
    canonicalCountryName,
  };
})();
