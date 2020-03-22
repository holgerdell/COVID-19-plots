/* COVID-19-plots.js | MIT License | github.com/holgerdell/COVID-19-plots */

import * as string from "./lib/string.js";
import * as itertools from "./lib/itertools.js";
import * as functools from "./lib/functools.js";
import * as jh from "./jh.js";
import * as countries from "./countries.js";
import * as owid from "./owid.js";

const DELAY_DEBOUNCE_SEARCH = 200;
const MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24;

/* We insist that the entire program's model state is stored in this dict. */
let state = {};

/* This dictionary holds the default values for the state
 * new toggles and options can simply be added here */
const defaultState = {
  "align": false,
  "normalize": true,
  "logplot": true,
  "legend": true,
  "dataset": "owid_total_cases",
  "countries": [
    "China", "Italy", "Denmark", "Germany", "Sweden", "Greece", "France",
  ],
};

/* The data never changes after it is put in this dict by the main function. */
let data = {};

/* Style configuration */
const PLOT_CIRCLE_RADIUS = 3;
const PLOT_LINE_STROKE_WIDTH = 3;


/** Return all available datasets
  * @return {List} of Strings
  */
function getDatasets() {
  /* This is a hack - should inspect data dictionary instead */
  return jh.types.map((x) => `jh_${x}`)
    .concat(owid.types.map((x) => `owid_${x}`));
}


/** Given an object and the total number of objects, returns a color
  * @param {Number} obj is the current object (between 0 and numObjects-1)
  * @param {Number} numObjects is the total number of colors needed
  *
  * @return {String} an RGB string, such as #ef1d99
  */
function color(obj, numObjects) {
  let fraction = 0;
  if (numObjects > 1) fraction = obj / (numObjects - 1);

  /* Alternative color schemes:
  return d3.interpolateSpectral(fraction);
  return d3.interpolateViridis(fraction);
  return d3.interpolateWarm(fraction);
  return d3.interpolateCool(fraction);
  */

  fraction = 1.5 * (1-fraction);
  if (fraction <= 1) return d3.color(d3.interpolateWarm(fraction)).darker(0.2);
  else return d3.color(d3.interpolateCool(2-fraction)).darker(0.2);
}

/** This function parses the URL parameters and returns an argv dictionary.
  * Also sets default values for known parameters.
  *
  * @return {Dictionary} a dictionary of all arguments
  */
function parseUrlArgs() {
  const argv = {};
  let match;
  const pl = /\+/g;
  const search = /([^&=]+)=?([^&]*)/g;
  const decode = (s) => decodeURIComponent(s.replace(pl, " "));
  const query = window.location.search.substring(1);

  while ((match = search.exec(query)) !== null) {
    argv[decode(match[1])] = decode(match[2]);
  }

  Object.keys(defaultState).forEach(function(key) {
    if (typeof defaultState[key] === "boolean") {
      if (argv[key]) {
        argv[key] = (argv[key] === "true");
      } else {
        argv[key] = defaultState[key];
      }
    } else if (typeof defaultState[key] === "string") {
      if (! argv[key]) {
        argv[key] = defaultState[key];
      }
    } else if (typeof defaultState[key] === "object") {
      if (argv[key]) {
        argv[key] = argv[key].split(";");
      } else {
        argv[key] = defaultState[key];
      }
    }
  });
  return argv;
}

/** This function is the inverse of parseUrlArgs.
  * @param {Dictionary} argv dictionary that is to be turned into URL arguments
  *
  * @return {String}
  */
function makeUrlQuerystring(argv) {
  let url = "";
  Object.keys(defaultState).forEach(function(key) {
    if (typeof defaultState[key] === "boolean" ||
      typeof defaultState[key] === "string") {
      if (argv[key] !== defaultState[key]) {
        url += key + "=" + argv[key] + "&";
      }
    } else if (typeof defaultState[key] === "object") {
      if (argv[key] !== defaultState[key]) {
        url += key + "=";
        for (const i in argv[key]) {
          if (argv[key].hasOwnProperty(i)) {
            const c = argv[key][i];
            url += c;
            if (i < argv[key].length - 1) {
              url += ";";
            }
          }
        }
        url += "&";
      }
    }
  });
  return url.slice(0, -1);
}


/** This function sets the URL that the browser displays
  * @param {String} querystring
  */
function setDisplayedUrlQuerystring(querystring) {
  const url = window.location.href;
  const urlParts = url.split("?");
  if (urlParts.length > 0) {
    const baseUrl = urlParts[0];
    // const oldQuerystring = urlParts[1];

    const updatedQueryString = querystring;

    let updatedUri = baseUrl;
    if (updatedQueryString != "") updatedUri += "?" + updatedQueryString;
    window.history.replaceState({}, document.title, updatedUri);
  }
}

/** Get a nice label for the y-axis
  * @param {Dictionary} state is the current state
  *
  * @return {String} human-readable description of the scale of the y-axis
  */
function ylabel(state) {
  let ylabel = "";
  if (state.dataset == "jh_Confirmed") {
    ylabel ="Confirmed Infections";
  } else if (state.dataset == "jh_Deaths") {
    ylabel ="Confirmed Deaths";
  } else if (state.dataset == "jh_Recovered") {
    ylabel ="Confirmed Recovered";
  }
  if (state.normalize) {
    ylabel += " (per 100,000 inhabitants)";
  }
  ylabel += " [dataset "+state.dataset+"]";
  if (state.logplot) {
    ylabel += " [log-plot]";
  }
  return ylabel;
}


/** This function returns a value of a given row of data["Time series"].
  * @param {Dictionary} row
  * @param {String} country
  * @param {String} dataset
  * @param {Boolean} normalize divide by population size or not?
  *
  * @return {Number}
  */
function getValue(
  row,
  country,
  dataset = state.dataset,
  normalize = state.normalize) {
  if (row[dataset] === undefined || row[dataset][country] === undefined) {
    return undefined;
  } else {
    let value = row[dataset][country];
    if (! typeof value === "number") {
      console.log("Error:", dataset, country, value, "is not a number");
    }
    if (normalize) {
      value = value * 100000.0 /
        parseInt(data["Country information"][country]["Population"], 10);
    }
    return value;
  }
}


/** This function is called when the model state has changed.
  * Its purpose is to update the view state.
 */
function onStateChange() {
  setDisplayedUrlQuerystring(makeUrlQuerystring(state));

  const tooltip = d3.select("#tooltip");
  tooltip.style("visibility", "hidden");

  d3.select("body").classed("loading", false);

  const width = document.getElementById("main").offsetWidth;
  const height = document.getElementById("main").offsetHeight;
  const margin = ({top: 20, right: 20, bottom: 60, left: 50});

  const svg = d3.select("main > svg");
  svg.html(null); // delete all children

  /* Check if all countries in the state are present in the data */
  for (const c of state.countries) {
    if (!(c in data["Country information"])) {
      svg.append("text").attr("x", 100).attr("y", 200)
        .text("ERROR: Did not find country '"+c+"' in data.");
      return;
    }
  }

  let xmax = -Infinity;
  let xmin = Infinity;
  Object.keys(data["Time series"]).forEach(function(datestring) {
    if (data["Time series"][datestring][state.dataset]) {
      const date = data["Time series"][datestring]["Date"];
      if (date < xmin) xmin = date;
      if (date > xmax) xmax = date;
    }
  });

  const massaged = [];
  let span = 1;

  state.countries.forEach((c, i) => {
    let first_event;
    /* Massage the data for this country */
    const countryData = [];
    for (const d of data["Time series"]) {
      const value = getValue(d, c, state.dataset, state.normalize);
      if (!isNaN(value) && value !== undefined && value > 0) {
        if (first_event === undefined) first_event = d["Date"];
        const ellapsed = (d["Date"] - first_event) /  MILLISECONDS_IN_A_DAY;
        span = Math.max(span, ellapsed);
        countryData.push({
          date: d["Date"],
          value: value,
          country: c,
          countryIndex: i,
          x: state.align ? ellapsed : d["Date"],
          y: value,
        });
      }
    }
    massaged.push(countryData);
  });


  /* x is a function that maps Date objects to x-coordinates on-screen */
  let x = null;
  if (state.align) {
    x = d3.scaleLinear()
      .domain([0, span]).nice()
      .range([margin.left, width - margin.right]);
  } else {
    x = d3.scaleUtc()
      .domain([xmin, xmax])
      .range([margin.left, width - margin.right]);
  }

  /* draw the x-axis */
  svg.append("g")
    .call(d3.axisBottom(x))
    .attr("transform", `translate(0,${height - margin.bottom})`);

  console.log("Using dataset", state.dataset);

  let ymax = -Infinity;
  let ymin = Infinity;
  for (let i=0; i < state.countries.length; i++) {
    const c = state.countries[i];
    for (const row of data["Time series"]) {
      const value = getValue(
        row, c, state.dataset, state.normalize
      );
      if (value !== undefined && value > ymax) ymax = value;
      if (value !== undefined && value < ymin && value > 0) ymin = value;
    };
  }
  console.log("Domain from", ymin, "to", ymax);

  /* y is a function that maps values to y-coordinates on-screen */
  const y = ((state.logplot) ? d3.scaleLog() : d3.scaleLinear())
    .domain([ymin, ymax]).nice()
    .range([height - margin.bottom, margin.top]);

  /* draw the y-axis */
  svg.append("g")
    .call(d3.axisLeft(y))
    .attr("transform", `translate(${margin.left},0)`)
    .call((g) => g.select(".domain").remove())
    .call((g) => g.select(".tick:last-of-type text").clone()
      .attr("x", 3)
      .attr("text-anchor", "start")
      .attr("font-weight", "bold")
      .text(ylabel(state)));

  massaged.forEach((countryData, i) => {
    /* draw the plot for each country */

    const line = d3.line()
      .x((d) => x(d.x))
      .y((d) => y(d.y));

    svg.append("path")
      .datum(countryData)
      .style("fill", "none")
      .style("stroke", color(i, state.countries.length))
      .attr("stroke-width", PLOT_LINE_STROKE_WIDTH)
      .attr("d", line);
    svg.selectAll()
      .data(countryData)
      .enter()
      .append("circle")
      .style("fill", color(i, state.countries.length))
      .attr("r", PLOT_CIRCLE_RADIUS)
      .attr("cx", (d) => x(d.x))
      .attr("cy", (d) => y(d.y))
      .on("mouseover", function(d, i) {
        d3.select(this).attr("r", 2*PLOT_LINE_STROKE_WIDTH);
        tooltip.html(d.country +
          "<br />Value: " + d.value.toLocaleString() +
          "<br />Date: " + d3.timeFormat("%Y-%m-%d")(d.date));
        return tooltip.style("visibility", "visible");
      })
      .on("mousemove", () => tooltip
        .style("top", (d3.event.pageY-10)+"px")
        .style("left", (d3.event.pageX+10)+"px"))
      .on("mouseout", function(d, i) {
        d3.select(this).transition().attr("r", PLOT_CIRCLE_RADIUS);
        return tooltip.style("visibility", "hidden");
      });
  } ) ;

  const legend = d3.select("#legend > .choices");
  legend.html(null); // delete all children
  for (let i=0; i < state.countries.length; i++) {
    const item = legend.append("div").classed("curve selected", true);
    item.append("span")
      .classed("avatar", true)
      .style("background-color", color(i, state.countries.length))
      .text(
        data["Country information"][state.countries[i]][countries.KEY_CODE]
      );
    item.append("span")
      .classed("label", true)
      .text(state.countries[i]);
    item
      .on("click", function(_) {
        state.countries = state.countries.filter(function(value, index, arr) {
          return value !== state.countries[i];
        });
        onStateChange();
      })
      .on("mouseover", function(_) {
        svg.selectAll("path")
          .filter((d) => (d && d.length > 0 && d[0].countryIndex === i))
          .transition().attr("stroke-width", 2*PLOT_LINE_STROKE_WIDTH);
        svg.selectAll("circle")
          .filter((d) => d.countryIndex === i)
          .transition().attr("r", 2*PLOT_CIRCLE_RADIUS);
        tooltip.html("Population: " +
          data["Country information"][state.countries[i]]["Population"]
            .toLocaleString());
        return tooltip.style("visibility", "visible");
      })
      .on("mousemove", () => tooltip
        .style("top", (d3.event.pageY-10)+"px")
        .style("left", (d3.event.pageX+10)+"px"))
      .on("mouseout", function(_) {
        svg.selectAll("path")
          .filter((d) => (d && d.length > 0 && d[0].countryIndex === i))
          .transition().attr("stroke-width", PLOT_LINE_STROKE_WIDTH);
        svg.selectAll("circle")
          .filter((d) => d.countryIndex === i)
          .transition().attr("r", PLOT_CIRCLE_RADIUS);
        return tooltip.style("visibility", "hidden");
      });
  }

  /* Draw currently inactive countries */
  Object.keys(data["Country information"]).forEach(function(key) {
    if (!(state.countries.includes(key))) {
      const item = legend.append("div").classed("curve", true);
      item.append("span")
        .classed("avatar", true)
        .text(data["Country information"][key][countries.KEY_CODE]);
      item.append("span")
        .classed("label", true)
        .text(key);
      item.on("click", function(_) {
        state.countries.push(key);
        onStateChange();
      });
    }
  });

  // Populate datalist for search feature
  const datalist = d3.select("#datalist-countries");
  datalist.html(null); // delete all children
  Object.keys(data["Country information"]).forEach(function(key) {
    datalist.append("option").attr("value", key);
  });
}


/** This function retrieves and massages the data
  * @return {Dictionary} the data dictionary
  */
async function getData() {
  let rows = await owid.load();
  for ( const type of jh.types ) {
    rows = rows.concat(await jh.load(type));
  }

  for ( const row of rows ) {
    row.date = d3.timeParse("%Y-%m-%d")(row.datestring);
  }

  const allCountries = new Set();
  for ( const row of rows ) {
    allCountries.add(row.country);
  }

  const countryData = await countries.load(2016, allCountries);

  /* now convert data to old data model (TODO: update consumers of getData()) */

  /* turn into dictionary, with "datestrings" as keys */
  const byDateSourceCountry = itertools.group(rows, "datestring");

  for ( const datestring of Object.keys(byDateSourceCountry) ) {
    /* turn into dictionary, with "source" as keys */
    byDateSourceCountry[datestring] =
      itertools.group(byDateSourceCountry[datestring], "source");
    for ( const source of Object.keys(byDateSourceCountry[datestring]) ) {
      /* turn into dictionary, with "country" as keys */
      byDateSourceCountry[datestring][source] =
        itertools.group(byDateSourceCountry[datestring][source], "country");
      /* now turn the row object into row.value */
      for ( const country
        of Object.keys(byDateSourceCountry[datestring][source]) ) {
        if (byDateSourceCountry[datestring][source][country].length !== 1) {
          console.error(datestring, source, country,
            byDateSourceCountry[datestring][source][country]);
        }
        byDateSourceCountry[datestring][source][country] =
          byDateSourceCountry[datestring][source][country][0].value;
      }
    }
    byDateSourceCountry[datestring]["Date"] =
      d3.timeParse("%Y-%m-%d")(datestring);
  }

  /* now forget the top-level grouping by date, but sort by date */
  const timeseries = Object.values(byDateSourceCountry);
  timeseries.sort(function(a, b) {
    return a["Date"] < b["Date"] ? -1 : a["Date"] > b["Date"] ? 1 : 0;
  });

  return {
    "Time series": timeseries,
    "Country information": Object.fromEntries(itertools.map(
      (item) => [item.country, {
        "Population": item.population,
        "Country Code": item.code,
      }], countryData)),
  };
}

/** The main function is called when the page has loaded */
async function main() {
  state = parseUrlArgs();

  data = await getData();

  onStateChange();

  /* Hook up event listeners to change the model state */
  const switchlog = () => {
    state.logplot = ! state.logplot;
    onStateChange();
  };
  d3.select("#log").on("click", switchlog);

  const switchnormalize = () => {
    state.normalize = ! state.normalize;
    onStateChange();
  };
  d3.select("#normalize").on("click", switchnormalize);

  const switchdatasets = function(stepsize = 1) {
    const ds = getDatasets();
    const i = ds.indexOf(state.dataset);
    state.dataset = ds[(i + stepsize + ds.length) % ds.length];
    onStateChange();
  };
  d3.select("#datasets").on("click", switchdatasets);
  const toggleAlign = () => {
    state.align = ! state.align;
    onStateChange();
  };
  d3.select("#align").on("click", toggleAlign);

  document.addEventListener("keydown", (event) => {
    switch (event.key) {
    case "l": switchlog(); break;
    case "n": switchnormalize(); break;
    case "d": switchdatasets(); break;
    case "D": switchdatasets(-1); break;
    case "a": toggleAlign(); break;
    }
  });

  window.onresize = onStateChange;

  // Search feature

  const countriesCodeMap = new Map();

  Object.keys(data["Country information"]).forEach(function(key) {
    const code = data["Country information"][key]["Country Code"];
    countriesCodeMap.set(code, key);
    countriesCodeMap.set(code.toLowerCase(), key);
  });

  const oninput = (e) => {
    const value = e.target.value;
    const keys = [
      value,
      string.titlecase(value.toLowerCase()),
      string.capitalize(value.toLowerCase()),
      string.capitalizeFirstLetter(value.toLowerCase()),
      countriesCodeMap.get(value),
    ];

    for ( const key of keys ) {
      if (key in data["Country information"]) {
        if (state.countries.includes(key)) {
          state.countries = state.countries.filter(
            (item) => item !== key
          );
        } else {
          state.countries.push(key);
        }
        e.target.value = "";
        onStateChange();
        break;
      }
    }
  };

  document.getElementById( "search" )
    .addEventListener(
      "input",
      functools.debounce( oninput, DELAY_DEBOUNCE_SEARCH )
    );

  document.getElementById( "search" )
    .addEventListener("keydown", (e) => e.stopPropagation());
}

window.onload = main;
