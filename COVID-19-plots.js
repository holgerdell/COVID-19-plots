/* COVID-19-plots.js | MIT License | github.com/holgerdell/COVID-19-plots */

/* We insist that the entire program's model state is stored in this dict. */
let state = {};

/* This dictionary holds the default values for the state
 * new toggles and options can simply be added here */
const defaultState = {
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
const PLOT_CIRCLE_RADIUS = 4;
const PLOT_LINE_STROKE_WIDTH = 3;


/** Return all available datasets
  * @return {List} of Strings
  */
function getDatasets() {
  /* This is a hack - should inspect data dictionary instead */
  return csse.types.map((x) => `jh_${x}`)
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

  fraction = 1.75 * (1-fraction);
  if (fraction <= 1) return d3.color(d3.interpolateWarm(fraction)).darker(0.2);
  else return d3.color(d3.interpolateCool(2-fraction)).darker(0.2);
}

/** This function parses the URL parameters and returns an argv dictionary.
  * Also sets default values for known parameters.
  *
  * @return {Dictionary} a dictionary of all arguments
  */
function parseUrlArgs() {
  let argv = {};
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
    if (typeof defaultState[key] === "boolean"
      || typeof defaultState[key] === "string") {
      if (argv[key] !== defaultState[key]) {
        url += key + "=" + argv[key] + "&";
      }
    } else if (typeof defaultState[key] === "object") {
      if (argv[key] !== defaultState[key]) {
        url += key + "=";
        for (let i in argv[key]) {
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
      value = value * 100000.0
        / parseInt(data["Country information"][country]["Population"]);
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

  if (!state.legend) {
    d3.select("#legend").style("display", "none");
  } else {
    d3.select("#legend").style("display", "grid");
  }
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

  /* x is a function that maps Date objects to x-coordinates on-screen */
  const x = d3.scaleUtc()
    .domain([xmin, xmax]).nice()
    .range([margin.left, width - margin.right]);

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

  /* draw the plot for each country */
  for (let i=0; i < state.countries.length; i++) {
    const c = state.countries[i];

    /* Massage the data for this country */
    const countryData = [];
    for (let j=0; j < data["Time series"].length; j++) {
      const d = data["Time series"][j];
      const value = getValue(d, c, state.dataset, state.normalize);
      if (value !== NaN && value !== undefined && value > 0) {
        countryData.push({
          date: d["Date"],
          value: value,
          country: c,
          countryIndex: i,
        });
      }
    }

    const line = d3.line()
      .x((d) => x(d.date))
      .y((d) => y(d.value));

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
      .attr("r", PLOT_LINE_STROKE_WIDTH)
      .attr("cx", (d) => x(d.date))
      .attr("cy", (d) => y(d.value))
      .on("mouseover", function(d, i) {
        d3.select(this).attr("r", 2*PLOT_LINE_STROKE_WIDTH);
        tooltip.html(d.country
          + "<br />Value: " + d.value.toLocaleString()
          + "<br />Date: " + d3.timeFormat("%Y-%m-%d")(d.date));
        return tooltip.style("visibility", "visible");
      })
      .on("mousemove", () => tooltip
        .style("top", (d3.event.pageY-10)+"px")
        .style("left", (d3.event.pageX+10)+"px"))
      .on("mouseout", function(d, i) {
        d3.select(this).transition().attr("r", PLOT_LINE_STROKE_WIDTH);
        return tooltip.style("visibility", "hidden");
      });
  }

  const legend = d3.select("#legend");
  legend.html(null); // delete all children
  for (let i=0; i < state.countries.length; i++) {
    const item = legend.append("div").classed("curve selected", true);
    item.append("span")
      .classed("avatar", true)
      .style("background-color", color(i, state.countries.length));
    item.append("span")
      .classed("label", true)
      .text(state.countries[i]);
    item
      .on("click", function(_, _) {
        state.countries = state.countries.filter(function(value, index, arr) {
          return value !== state.countries[i];
        });
        onStateChange();
      })
      .on("mouseover", function(_, _) {
        svg.selectAll("circle")
          .filter((d) => d.countryIndex === i)
          .transition().attr("r", 2*PLOT_LINE_STROKE_WIDTH);
        svg.selectAll("path")
          .filter((d) => (d && d.length > 0 && d[0].countryIndex === i))
          .transition().attr("stroke-width", 2*PLOT_LINE_STROKE_WIDTH);
        tooltip.html("Population: "
          + data["Country information"][state.countries[i]]["Population"]
            .toLocaleString());
        return tooltip.style("visibility", "visible");
      })
      .on("mousemove", () => tooltip
        .style("top", (d3.event.pageY-10)+"px")
        .style("left", (d3.event.pageX+10)+"px"))
      .on("mouseout", function(_, _) {
        svg.selectAll("circle")
          .filter((d) => d.countryIndex === i)
          .transition().attr("r", PLOT_LINE_STROKE_WIDTH);
        svg.selectAll("path")
          .filter((d) => (d && d.length > 0 && d[0].countryIndex === i))
          .transition().attr("stroke-width", PLOT_LINE_STROKE_WIDTH);
        return tooltip.style("visibility", "hidden");
      });
  }

  /* Draw currently inactive countries */
  Object.keys(data["Country information"]).forEach(function(key) {
    if (!(state.countries.includes(key))) {
      const item = legend.append("div").classed("curve", true);
      item.append("span")
        .classed("avatar", true);
      item.append("span")
        .classed("label", true)
        .text(key);
      item.on("click", function(_, _) {
        state.countries.push(key);
        onStateChange();
      });
    }
  });
}


/** This function retrieves and massages the data
  * @return {Dictionary} the data dictionary
  */
async function getData() {
  const byDate = {};
  const allCountries = new Set();

  for ( const type of csse.types ) {
    const rows = await csse.load(type);
    for ( const row of rows ) {
      const datestring = row[csse.KEY_DATE];
      if (byDate[datestring] === undefined) {
        byDate[datestring] = {};
        byDate[datestring]["Date"] =
          d3.timeParse("%Y-%m-%d")(datestring);
      }
      byDate[datestring]["jh_"+type] = Object.fromEntries(itertools.filter(
        ([key, value]) => key !== csse.KEY_DATE,
        Object.entries(row),
      ));
      for (const country of
        itertools.filter((x) => x !== csse.KEY_DATE, Object.keys(row))) {
        allCountries.add(country);
      }
    }
  }


  for ( const type of owid.types ) {
    const rows = await owid.load(type);
    for ( const row of rows ) {
      const datestring = row[owid.KEY_DATE];
      if (byDate[datestring] === undefined) {
        byDate[datestring] = {};
        byDate[datestring]["Date"] =
          d3.timeParse("%Y-%m-%d")(datestring);
      }
      byDate[datestring]["owid_"+type] = Object.fromEntries(itertools.filter(
        ([key, value]) => key !== owid.KEY_DATE,
        Object.entries(row),
      ));
      for (const country of
        itertools.filter((x) => x !== owid.KEY_DATE, Object.keys(row))) {
        allCountries.add(country);
      }
    }
  }


  const timeseries = [];
  Object.keys(byDate).forEach(function(datestring) {
    timeseries.push(byDate[datestring]);
  });
  timeseries.sort(function(a, b) {
    return a["Date"] < b["Date"] ? -1 : a["Date"] > b["Date"] ? 1 : 0;
  });

  const population = await countries.load(2016, allCountries);
  return {
    "Time series": timeseries,
    "Country information": Object.fromEntries(itertools.map(
      (item) => [item[countries.KEY_NAME], {
        "Population": item[countries.KEY_VALUE],
        "Country Code": item[countries.KEY_CODE],
      }], population)),
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

  document.addEventListener("keydown", (event) => {
    switch (event.key) {
    case "l": switchlog(); break;
    case "n": switchnormalize(); break;
    case "d": switchdatasets(); break;
    case "D": switchdatasets(-1); break;
    }
  });

  window.onresize = onStateChange;
}

window.onload = main;
