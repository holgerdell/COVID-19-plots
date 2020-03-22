"use strict";

/* Retrieve data from Our World in Data
 * https://ourworldindata.org/coronavirus-source-data
 */
const owid = (() => {
  const URL = "https://covid.ourworldindata.org/data/ecdc/full_data.csv";
  const KEY_DATE = "date";
  const KEY_COUNTRY = "location";
  const TYPE_CASES = "total_cases";
  const TYPE_DEATHS = "total_deaths";

  const types = [TYPE_CASES, TYPE_DEATHS];

  const load = (type) => {
    return new Promise(function(resolve, reject) {
      d3.csv(URL).then((rows) => resolve(groupByDate(rows, type)));
    });
  };


  /** This function retrieves and massages the data
    * @param {List} rows the rows of the CSV file
    * @param {List} type the column that we want to return
    *
    * @return {List} list of rows; each row contains the field "Date"
    *                as well as one field for each country.
    */
  function groupByDate(rows, type) {
    const byDate = {};
    for ( const row of rows ) {
      const datestring = row[KEY_DATE];
      const country = countries.canonicalCountryName(row[KEY_COUNTRY]);
      const value = parseInt(row[type], 10);

      if (byDate[datestring] === undefined) {
        byDate[datestring] = {};
        byDate[datestring][KEY_DATE] = datestring;
      }
      byDate[datestring][country] = value;
    }

    const timeseries = [];
    Object.keys(byDate).forEach(function(datestring) {
      timeseries.push(byDate[datestring]);
    });
    timeseries.sort(function(a, b) {
      a[KEY_DATE] < b[KEY_DATE] ? -1 : a[KEY_DATE] > b[KEY_DATE] ? 1 : 0;
    });
    return timeseries;
  }

  return {
    load,
    TYPE_DEATHS,
    TYPE_CASES,
    types,
    KEY_DATE,
  };
})();
