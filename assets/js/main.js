/* COVID-19-plots.js | MIT License | github.com/holgerdell/COVID-19-plots */

import * as string from './lib/string.js'
import * as itertools from './lib/itertools.js'
import * as functools from './lib/functools.js'
import * as jh from './jh.js'
import * as countries from './countries.js'
import * as owid from './owid.js'

const DELAY_DEBOUNCE_SEARCH = 200
const MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24

/* We insist that the entire program's model state is stored in this dict. */
let state = {}

/* This dictionary holds the default values for the state
 * new toggles and options can simply be added here */
const defaultState = {
  align: false,
  cumulative: true,
  normalize: true,
  logplot: true,
  legend: true,
  dataset: 'owid_' + owid.TYPE_CASES,
  countries: [
    'China', 'Italy', 'Denmark', 'Germany', 'Sweden', 'Greece', 'France'
  ]
}

/* The data never changes after it is put in this dict by the main function. */
let timeseriesData = {}

/* Style configuration */
const PLOT_CIRCLE_RADIUS = 3
const PLOT_LINE_STROKE_WIDTH = 3

/* Align curve threshold */
const ALIGN_THRESHOLD_NORMALIZED = 0.1 // align to first day >= 0.1 cases per 100,000
const ALIGN_THRESHOLD = 100 // align to first day with >= 100 cases

/** Return all available datasets
  * @return {List} of Strings
  */
function getDatasets () {
  return jh.types.map((x) => `jh_${x}`)
    .concat(owid.types.map((x) => `owid_${x}`))
}

/** Given an object and the total number of objects, returns a color
  * @param {Number} obj is the current object (between 0 and numObjects-1)
  * @param {Number} numObjects is the total number of colors needed
  *
  * @return {String} an RGB string, such as #ef1d99
  */
function color (obj, numObjects) {
  let fraction = 0
  if (numObjects > 1) fraction = obj / (numObjects - 1)

  /* Alternative color schemes:
  return d3.interpolateSpectral(fraction);
  return d3.interpolateViridis(fraction);
  return d3.interpolateWarm(fraction);
  return d3.interpolateCool(fraction);
  */

  fraction = 1.5 * (1 - fraction)
  if (fraction <= 1) return d3.color(d3.interpolateWarm(fraction)).darker(0.2)
  else return d3.color(d3.interpolateCool(2 - fraction)).darker(0.2)
}

/** This function parses the URL parameters and returns an argv dictionary.
  * Also sets default values for known parameters.
  *
  * @return {Dictionary} a dictionary of all arguments
  */
function parseUrlArgs () {
  const argv = {}
  let match
  const pl = /\+/g
  const search = /([^&=]+)=?([^&]*)/g
  const decode = (s) => decodeURIComponent(s.replace(pl, ' '))
  const query = window.location.search.substring(1)

  while ((match = search.exec(query)) !== null) {
    argv[decode(match[1])] = decode(match[2])
  }

  Object.keys(defaultState).forEach(function (key) {
    if (typeof defaultState[key] === 'boolean') {
      if (argv[key]) {
        argv[key] = (argv[key] === 'true')
      } else {
        argv[key] = defaultState[key]
      }
    } else if (typeof defaultState[key] === 'string') {
      if (!argv[key]) {
        argv[key] = defaultState[key]
      }
    } else if (typeof defaultState[key] === 'object') {
      if (argv[key]) {
        argv[key] = argv[key].split(';')
      } else {
        argv[key] = defaultState[key]
      }
    }
  })
  return argv
}

/** This function is the inverse of parseUrlArgs.
  * @param {Dictionary} argv dictionary that is to be turned into URL arguments
  *
  * @return {String}
  */
function makeUrlQuerystring (argv) {
  let url = ''
  Object.keys(defaultState).forEach(function (key) {
    if (typeof defaultState[key] === 'boolean' ||
      typeof defaultState[key] === 'string') {
      if (argv[key] !== defaultState[key]) {
        url += key + '=' + argv[key] + '&'
      }
    } else if (typeof defaultState[key] === 'object') {
      if (argv[key] !== defaultState[key]) {
        url += key + '='
        for (const i of Object.keys(argv[key])) {
          const c = argv[key][i]
          url += c
          if (i < argv[key].length - 1) {
            url += ';'
          }
        }
        url += '&'
      }
    }
  })
  return url.slice(0, -1)
}

/** This function sets the URL that the browser displays
  * @param {String} querystring
  */
function setDisplayedUrlQuerystring (querystring) {
  const url = window.location.href
  const urlParts = url.split('?')
  if (urlParts.length > 0) {
    const baseUrl = urlParts[0]
    // const oldQuerystring = urlParts[1];

    const updatedQueryString = querystring

    let updatedUri = baseUrl
    if (updatedQueryString !== '') updatedUri += '?' + updatedQueryString
    window.history.replaceState({}, document.title, updatedUri)
  }
}

/** Get a nice label for the y-axis
  * @param {Dictionary} state is the current state
  *
  * @return {String} human-readable description of the scale of the y-axis
  */
function ylabel (state) {
  let ylabel = ''
  if (state.dataset === 'jh_' + jh.TYPE_CONFIRMED || state.dataset === 'owid_' + owid.TYPE_CASES) {
    ylabel = 'Confirmed Infections'
  } else if (state.dataset === 'jh_' + jh.TYPE_DEATHS || state.dataset === 'owid_' + owid.TYPE_DEATHS) {
    ylabel = 'Confirmed Deaths'
  } else if (state.dataset === 'jh_' + jh.TYPE_RECOVERED) {
    ylabel = 'Confirmed Recovered'
  }
  if (state.normalize) {
    ylabel += ' (per 100,000 inhabitants)'
  }
  ylabel += ' [dataset ' + state.dataset + ']'
  if (state.logplot) {
    ylabel += ' [log-plot]'
  }
  return ylabel
}

/** This function returns a value of a given row of timeseriesData.
  * @param {Dictionary} row
  * @param {String} country
  * @param {String} dataset
  * @param {Boolean} normalize divide by population size or not?
  *
  * @return {Number}
  */
function getValue (
  row,
  country,
  dataset = state.dataset,
  normalize = state.normalize) {
  if (row[dataset] === undefined || row[dataset][country] === undefined) {
    return undefined
  } else {
    let value = row[dataset][country]
    if (!(typeof value === 'number')) {
      console.error('Error:', dataset, country, value, 'is not a number')
    }
    if (normalize) {
      value = value * 100000.0 /
        parseInt(countries.getInfo(country).population, 10)
    }
    return value
  }
}

/** This function is called when the model state has changed.
  * Its purpose is to update the view state.
 */
function onStateChange () {
  console.debug('Using dataset', state.dataset)

  state.logplot = state.logplot && state.cumulative

  setDisplayedUrlQuerystring(makeUrlQuerystring(state))

  const tooltip = d3.select('#tooltip')
  tooltip.style('visibility', 'hidden')

  d3.select('body').classed('loading', false)
  d3.select('#cumulative').classed('toggled', state.cumulative)
  d3.select('#log').classed('toggled', state.logplot)
  d3.select('#log').classed('disabled', !state.cumulative)
  document.getElementById('log').removeEventListener('click', toggleLog)
  if (state.cumulative) {
    document.getElementById('log').addEventListener('click', toggleLog)
  }
  d3.select('#normalize').classed('toggled', state.normalize)
  d3.select('#align').classed('toggled', state.align)

  if (state.normalize) {
    d3.select('#align > div').text(`Align by first day with ${ALIGN_THRESHOLD_NORMALIZED} cases per 100,000 [a]`)
  } else {
    d3.select('#align > div').text(`Align by first day with ${ALIGN_THRESHOLD} cases [a]`)
  }

  const datasets = getDatasets()
  const datasetButtonColor = color(datasets.indexOf(state.dataset), datasets.length)
  d3.select('#datasets').style('background-color', datasetButtonColor)

  const width = document.getElementById('main').offsetWidth
  const height = document.getElementById('main').offsetHeight
  const margin = ({ top: 20, right: 20, bottom: 60, left: 50 })

  const svg = d3.select('main > svg')
  svg.html(null) // delete all children

  /* Check if all countries in the state are present in the data */
  for (const c of state.countries) {
    if (countries.getInfo(c) === undefined) {
      svg.append('text').attr('x', 100).attr('y', 200)
        .text("ERROR: Did not find country '" + c + "' in data.")
      return
    }
  }

  const massaged = []

  state.countries.forEach((c, i) => {
    let firstDateAboveThreshold
    let previousValue = 0
    /* Massage the data for this country */
    const countryData = []
    for (const d of timeseriesData) {
      const cumulative = getValue(d, c, state.dataset, state.normalize)
      if (!isNaN(cumulative) && cumulative !== undefined && cumulative > 0) {
        let yvalue = cumulative
        if (!state.cumulative) {
          yvalue -= previousValue
          previousValue = cumulative
        }
        let xvalue
        if (!state.align) {
          xvalue = d.Date
        } else {
          const threshold = (state.normalize) ? ALIGN_THRESHOLD_NORMALIZED : ALIGN_THRESHOLD
          if (firstDateAboveThreshold === undefined && cumulative >= threshold) firstDateAboveThreshold = d.Date
          if (firstDateAboveThreshold !== undefined) {
            xvalue = (d.Date - firstDateAboveThreshold) / MILLISECONDS_IN_A_DAY
          }
        }
        if (xvalue !== undefined) {
          countryData.push({
            date: d.Date,
            value: yvalue,
            country: c,
            countryIndex: i,
            x: xvalue,
            y: yvalue
          })
        }
      }
    }
    massaged.push(countryData)
  })

  let xmax = -Infinity
  let xmin = Infinity
  let ymax = -Infinity
  let ymin = Infinity
  massaged.forEach((countryData) => {
    for (const { x: xvalue, y: yvalue } of countryData) {
      if (xvalue > xmax) xmax = xvalue
      if (xvalue < xmin) xmin = xvalue
      if (yvalue > ymax) ymax = yvalue
      if (yvalue < ymin) ymin = yvalue
    }
  })
  if (!state.logplot) ymin = 0
  console.debug(`x-axis from ${xmin} to ${xmax}`)
  console.debug(`y-axis from ${ymin} to ${ymax}`)

  /* x is a function that maps Date objects to x-coordinates on-screen */
  let x = null
  if (state.align) {
    x = d3.scaleLinear()
      .domain([xmin, xmax]).nice()
      .range([margin.left, width - margin.right])
  } else {
    x = d3.scaleUtc()
      .domain([xmin, xmax])
      .range([margin.left, width - margin.right])
  }

  /* draw the x-axis */
  svg.append('g')
    .call(d3.axisBottom(x))
    .attr('transform', `translate(0,${height - margin.bottom})`)

  /* y is a function that maps values to y-coordinates on-screen */
  const y = ((state.logplot) ? d3.scaleLog() : d3.scaleLinear())
    .domain([ymin, ymax])
    .range([height - margin.bottom, margin.top])

  /* draw the y-axis */
  svg.append('g')
    .call(d3.axisLeft(y))
    .attr('transform', `translate(${margin.left},0)`)
    .call((g) => g.select('.domain').remove())
    .call((g) => g.select('.tick:last-of-type text').clone()
      .attr('x', 3)
      .attr('text-anchor', 'start')
      .attr('font-weight', 'bold')
      .text(ylabel(state)))

  massaged.forEach((countryData, i) => {
    /* draw the plot for each country */

    const line = d3.line()
      .x((d) => x(d.x))
      .y((d) => y(d.y))

    svg.append('path')
      .datum(countryData)
      .style('fill', 'none')
      .style('stroke', color(i, state.countries.length))
      .attr('stroke-width', PLOT_LINE_STROKE_WIDTH)
      .attr('d', line)
    svg.selectAll()
      .data(countryData)
      .enter()
      .append('circle')
      .style('fill', color(i, state.countries.length))
      .attr('r', PLOT_CIRCLE_RADIUS)
      .attr('cx', (d) => x(d.x))
      .attr('cy', (d) => y(d.y))
      .on('mouseover', function (d, i) {
        d3.select(this).attr('r', 2 * PLOT_LINE_STROKE_WIDTH)
        tooltip.html(d.country +
          '<br />Value: ' + d.value.toLocaleString() +
          '<br />Date: ' + d3.timeFormat('%Y-%m-%d')(d.date))
        return tooltip.style('visibility', 'visible')
      })
      .on('mousemove', () => tooltip
        .style('top', (d3.event.pageY - 15) + 'px')
        .style('right', (document.body.offsetWidth - d3.event.pageX + 20) + 'px'))
      .on('mouseout', function (d, i) {
        d3.select(this).transition().attr('r', PLOT_CIRCLE_RADIUS)
        return tooltip.style('visibility', 'hidden')
      })
  })

  const legend = d3.select('#legend > .choices')

  /* collect country data */
  let allCountries = Object.values(countries.getAll())
  for (const c of allCountries) {
    c.idx = state.countries.findIndex((n) => n === c.country)
    c.isSelected = c.idx >= 0
  }
  const selected = allCountries.filter(c => c.isSelected)
  const unselected = allCountries.filter(c => !c.isSelected)
  allCountries = selected.concat(unselected)

  /* this is a hack an should be replaced with selection.join() */
  legend.html('')

  const item = legend.selectAll('div').data(allCountries, c => c.country).enter().append('div')

  item
    .classed('curve', true)
    .classed('selected', c => c.isSelected)
    .append('span')
    .classed('avatar', true)
    .style('background-color', c => (c.isSelected) ? color(c.idx, state.countries.length) : undefined)
    .text(c => c.code)
  item
    .append('span')
    .classed('label', true)
    .text(c => c.country)
  item
    .on('click', function (c) {
      if (c.isSelected) {
        state.countries = state.countries.filter(function (value, _) {
          console.log(value)
          return value !== c.country
        })
      } else {
        state.countries.push(c.country)
      }
      onStateChange()
    })
    .on('mouseover', function (c) {
      svg.selectAll('path')
        .filter((d) => (d && d.length > 0 && d[0].countryIndex === c.idx))
        .transition().attr('stroke-width', 2 * PLOT_LINE_STROKE_WIDTH)
      svg.selectAll('circle')
        .filter((d) => d.countryIndex === c.idx)
        .transition().attr('r', 2 * PLOT_CIRCLE_RADIUS)
      tooltip.html('Population: ' + c.population.toLocaleString())
      return tooltip.style('visibility', 'visible')
    })
    .on('mousemove', () => tooltip
      .style('top', (d3.event.pageY - 15) + 'px')
      .style('right', (document.body.offsetWidth - d3.event.pageX + 20) + 'px'))
    .on('mouseout', function (c) {
      svg.selectAll('path')
        .filter((d) => (d && d.length > 0 && d[0].countryIndex === c.idx))
        .transition().attr('stroke-width', PLOT_LINE_STROKE_WIDTH)
      svg.selectAll('circle')
        .filter((d) => d.countryIndex === c.idx)
        .transition().attr('r', PLOT_CIRCLE_RADIUS)
      return tooltip.style('visibility', 'hidden')
    })

  // Populate datalist for search feature
  const datalist = d3.select('#datalist-countries')
  datalist.html(null) // delete all children
  countries.forEach(function (c) {
    datalist.append('option').attr('value', c.country)
  })
}

/** This function retrieves and massages the data
  * @return {Dictionary} the data dictionary
  */
async function getData () {
  let rows = await owid.load()
  for (const type of jh.types) {
    rows = rows.concat(await jh.load(type))
  }

  for (const row of rows) {
    row.date = d3.timeParse('%Y-%m-%d')(row.datestring)
  }

  const allCountries = new Set()
  for (const row of rows) {
    allCountries.add(row.country)
  }
  await countries.load(allCountries)

  /* now convert data to old data model (TODO: update consumers of getData()) */

  /* turn into dictionary, with "datestrings" as keys */
  const byDateSourceCountry = itertools.group(rows, 'datestring')

  for (const datestring of Object.keys(byDateSourceCountry)) {
    /* turn into dictionary, with "source" as keys */
    byDateSourceCountry[datestring] =
      itertools.group(byDateSourceCountry[datestring], 'source')
    for (const source of Object.keys(byDateSourceCountry[datestring])) {
      /* turn into dictionary, with "country" as keys */
      byDateSourceCountry[datestring][source] =
        itertools.group(byDateSourceCountry[datestring][source], 'country')
      /* now turn the row object into row.value */
      for (const country
        of Object.keys(byDateSourceCountry[datestring][source])) {
        if (byDateSourceCountry[datestring][source][country].length !== 1) {
          console.error(datestring, source, country,
            byDateSourceCountry[datestring][source][country])
        }
        byDateSourceCountry[datestring][source][country] =
          byDateSourceCountry[datestring][source][country][0].value
      }
    }
    byDateSourceCountry[datestring].Date =
      d3.timeParse('%Y-%m-%d')(datestring)
  }

  /* now forget the top-level grouping by date, but sort by date */
  timeseriesData = Object.values(byDateSourceCountry)
  timeseriesData.sort(function (a, b) {
    return a.Date < b.Date ? -1 : a.Date > b.Date ? 1 : 0
  })
}

/** The main function is called when the page has loaded */
async function main () {
  state = parseUrlArgs()

  await getData()

  onStateChange()

  /* Hook up event listeners to change the model state */
  d3.select('#cumulative').on('click', toggleCumulative)
  d3.select('#normalize').on('click', toggleNormalize)
  d3.select('#align').on('click', toggleAlign)
  d3.select('#datasets').on('click', nextDataSet)

  document.addEventListener('keydown', (event) => {
    if (!event.ctrlKey && !event.altKey) {
      switch (event.key) {
        case 'c': toggleCumulative(); break
        case 'l': toggleLog(); break
        case 'n': toggleNormalize(); break
        case 'd': nextDataSet(); break
        case 'D': prevDataSet(); break
        case 'a': toggleAlign(); break
      }
    }
  })

  window.onresize = onStateChange

  // Search feature

  const countriesCodeMap = new Map()

  countries.forEach(function (c) {
    countriesCodeMap.set(c.code, c.country)
    countriesCodeMap.set(c.code.toLowerCase(), c.country)
  })

  const oninput = (e) => {
    const value = e.target.value
    const keys = [
      value,
      string.titlecase(value.toLowerCase()),
      string.capitalize(value.toLowerCase()),
      string.capitalizeFirstLetter(value.toLowerCase()),
      countriesCodeMap.get(value)
    ]

    for (const key of keys) {
      if (countries.getInfo(key) !== undefined) {
        if (state.countries.includes(key)) {
          state.countries = state.countries.filter(
            (item) => item !== key
          )
        } else {
          state.countries.push(key)
        }
        e.target.value = ''
        onStateChange()
        break
      }
    }
  }

  document.getElementById('search')
    .addEventListener(
      'input',
      functools.debounce(oninput, DELAY_DEBOUNCE_SEARCH)
    )

  document.getElementById('search')
    .addEventListener('keydown', (e) => e.stopPropagation())
}

function toggleCumulative () {
  state.cumulative = !state.cumulative
  onStateChange()
}

function toggleLog () {
  state.logplot = !state.logplot
  onStateChange()
}

function toggleNormalize () {
  state.normalize = !state.normalize
  onStateChange()
}

function toggleAlign () {
  state.align = !state.align
  onStateChange()
}

function switchdatasets (stepsize) {
  const ds = getDatasets()
  const oldIndex = ds.indexOf(state.dataset)
  const newIndex = (oldIndex + stepsize + ds.length) % ds.length
  state.dataset = ds[newIndex]
  onStateChange()
}

const nextDataSet = () => switchdatasets(+1)
const prevDataSet = () => switchdatasets(-1)

window.onload = main
