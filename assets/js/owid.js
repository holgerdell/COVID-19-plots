import * as countries from "./countries.js";

/* Retrieve data from Our World in Data
 * https://ourworldindata.org/coronavirus-source-data
 */
const URL = "https://covid.ourworldindata.org/data/ecdc/full_data.csv";
export const KEY_DATE = "date";
export const KEY_COUNTRY = "location";
export const TYPE_CASES = "total_cases";
export const TYPE_DEATHS = "total_deaths";

export const types = [TYPE_CASES, TYPE_DEATHS];

export const load = () => {
  return new Promise(function(resolve, reject) {
    d3.csv(URL).then((rows) => resolve(Array.from(sanitize(rows))));
  });
};


/** This function sanitizes the data and selects a type
  * @param {Dictionary} rows the rows of the CSV file
  */
function* sanitize(rows) {
  for (const row of rows) {
    for (const type of types) {
      yield {
        country: countries.canonicalCountryName(row[KEY_COUNTRY]),
        datestring: row[KEY_DATE],
        value: parseInt(row[type], 10),
        source: "owid_"+type,
      };
    }
  }
}
