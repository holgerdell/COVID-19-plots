/* COVID-19-plots.js | MIT License | github.com/holgerdell/COVID-19-plots */


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


/** The main function is called when the page has loaded */
async function main() {
  let argv = {};
  let match;
  const pl = /\+/g;
  const search = /([^&=]+)=?([^&]*)/g;
  const decode = (s) => decodeURIComponent(s.replace(pl, " "));
  const query = window.location.search.substring(1);

  while ((match = search.exec(query)) !== null) {
    argv[decode(match[1])] = decode(match[2]);
  }

  if (argv.normalize) {
    argv.normalize = (argv.normalize == "true");
  } else {
    argv.normalize = true;
  }

  if (argv.logplot) {
    argv.logplot = (argv.logplot == "true");
  } else {
    argv.logplot = false;
  }

  if (argv.countries) {
    argv.countries = argv.countries.split(";");
  } else {
    argv.countries = [
      "China", "Italy", "Denmark", "Germany", "Sweden", "Greece", "France",
    ];
  }

  if (argv.legend) {
    argv.legend = (argv.legend == "true");
  } else {
    argv.legend = true;
  }

  if (! argv.dataset) {
    argv.dataset = "jh_Confirmed";
  }

  if (!argv.legend) {
    document.getElementById("legend").style.display = "none";
  }

  const data = await d3.json("data/data.json");

  const width = document.getElementById("main").offsetWidth;
  const height = document.getElementById("main").offsetHeight;

  const margin = ({top: 70, right: 20, bottom: 80, left: 50});

  const svg = d3.select("main > svg");


  for (let i in argv.countries) {
    if (argv.countries.hasOwnProperty(i)) {
      const c = argv.countries[i];
      if (!(c in data["Country information"])) {
        svg.append("text").attr("x", 100).attr("y", 200)
          .text("ERROR: Did not find country '"+c+"' in data.");
        return false;
      }
    }
  }

  const parseDate = d3.timeParse("%Y-%m-%d");
  const x = d3.scaleUtc()
    .domain(d3.extent(data["Time series"], (e) => parseDate(e["Date"])))
    .range([margin.left, width - margin.right]);

  const xAxis = (g) => g
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0));


  /** Given a value and country, return normalized value (if desired)
    * @param {Number} value is a numerical value for the country
    * @param {Number} country is the name of the country
    *
    * @return {Number} value normalized to incidence per 1 million inhabitants
  */
  function rescale(value, country) {
    if (argv.normalize) {
      value = value * 1000000.0
        / parseInt(data["Country information"][country]["Population"]);
    }
    if (argv.logplot) {
      if (value > 1) {
        value = Math.log(value);
      } else {
        value = NaN;
      }
    }
    return value;
  }

  svg.append("g").call(xAxis);

  console.log("Using dataset", argv.dataset);

  let ymax = -Infinity;
  let ymin = Infinity;
  for (let i in argv.countries) {
    if (argv.countries.hasOwnProperty(i)) {
      const c = argv.countries[i];
      const n = d3.max(data["Time series"],
        (e) => rescale(e[argv.dataset][c], c));
      console.log("Max number for", c, "is", n);
      if (n > ymax) ymax = n;
      const m = d3.min(data["Time series"],
        (e) => rescale(e[argv.dataset][c], c));
      if (m < ymin) ymin = m;
    }
  }
  console.log("Domain from", ymin, "to", ymax);
  const y = d3.scaleLinear()
    .domain([ymin, ymax]).nice()
    .range([height - margin.bottom, margin.top]);

  let ylabel = "";
  if (argv.dataset == "jh_Confirmed") {
    ylabel ="Confirmed Infections";
  } else if (argv.dataset == "jh_Deaths") {
    ylabel ="Confirmed Deaths";
  } else if (argv.dataset == "jh_Recovered") {
    ylabel ="Confirmed Recovered";
  }
  if (argv.normalize) {
    ylabel += " (per 1 million inhabitants)";
  }
  if (argv.logplot) {
    ylabel = "Log of " + ylabel;
  }
  ylabel += " [dataset "+argv.dataset+"]";

  const yAxis = (g) => g
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y))
    .call((g) => g.select(".domain").remove())
    .call((g) => g.select(".tick:last-of-type text").clone()
      .attr("x", 3)
      .attr("text-anchor", "start")
      .attr("font-weight", "bold")
      .text(ylabel));

  svg.append("g")
    .call(yAxis);

  const line = (country) => d3.line()
    .defined((d) => !isNaN(rescale(d[argv.dataset][country], country)))
    .x((d) => x(parseDate(d["Date"])))
    .y((d) => y(rescale(d[argv.dataset][country], country)));


  for (let i in argv.countries) {
    if (argv.countries.hasOwnProperty(i)) {
      const c = argv.countries[i];
      svg.append("path")
        .datum(data["Time series"])
        .attr("fill", "none")
        .attr("stroke", color(i, argv.countries.length))
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", line(c));
    }
  }

  /*
  // Print legend
  let d = {}
  for (let i in argv.countries) {
    if (argv.countries.hasOwnProperty(i)) {
    //  c = argv.countries[i];
    //  d[c] =
    }
  }
  */
  const legend = d3.select("#legend");
  for (let i in argv.countries) {
    if (argv.countries.hasOwnProperty(i)) {
      const item = legend.append("svg");
      item.append("circle")
        .attr("cx", 25).attr("cy", 25).attr("r", 25)
        .style("fill", color(i, argv.countries.length));
      item.append("text")
        .attr("x", 60).attr("y", 25)
        .text(argv.countries[i]);
    }
  }
  return svg.node();
}

window.onload = main;
