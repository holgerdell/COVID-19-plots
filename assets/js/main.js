/* COVID-19-plots.js | MIT License | github.com/holgerdell/COVID-19-plots */

import * as string from './lib/string.js'
import * as functools from './lib/functools.js'
import * as data from './data.js'
import * as countries from './countries.js'

/* We insist that the entire program's model state is stored in this dict. */
let state = {}

/* This dictionary holds the default values for the state
 * new toggles and options can simply be added here */
const defaultState = {
  plot: 'time',
  align: false,
  cumulative: true,
  normalize: true,
  logplot: true,
  legend: true,
  dataset: data.defaultDataset,
  countries: [
    'China', 'Italy', 'Denmark', 'Germany', 'Sweden', 'Greece', 'France'
  ]
}

/* Search configuration */
const DELAY_DEBOUNCE_SEARCH = 200

/* Time constants*/
const MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24

/* Style configuration */
const PLOT_CIRCLE_RADIUS = 3
const PLOT_LINE_STROKE_WIDTH = 3

/* Align curve threshold */
const ALIGN_THRESHOLD_NORMALIZED = 0.1 // align to first day >= 0.1 cases per 100,000
const ALIGN_THRESHOLD = 100 // align to first day with >= 100 cases

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
  let ylabel = data.describe(state.dataset)
  if (state.normalize) {
    ylabel += ' (per 100,000 inhabitants)'
  }
  ylabel += ' [dataset ' + state.dataset + ']'
  if (state.logplot) {
    ylabel += ' [log-plot]'
  }
  return ylabel
}

/** This function is called when the model state has changed.
  * Its purpose is to update the view state.
 */
async function onStateChange () {
  console.debug('Using dataset', state.dataset)

  state.logplot = state.logplot && state.cumulative // cannot be both logplot and cumulative ?

  setDisplayedUrlQuerystring(makeUrlQuerystring(state))

  d3.select('#tooltip').style('visibility', 'hidden')
  drawNav(state)
  await drawPlot(state) // timeSeriesData is loaded here
  drawLegend(state) // requires timeSeriesData to be loaded
}

async function drawPlot ( state ) {

  const tooltip = d3.select('#tooltip')

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

  d3.select('body').classed('loading', true)
  await data.fetchTimeSeriesData(state.dataset)
  d3.select('body').classed('loading', false)

  const massaged = []
  state.countries.forEach(function (c, i) {
    let firstDateAboveThreshold
    let previousValue = 0
    /* Massage the data for this country */
    let countryData = data.getTimeSeries(c, state.dataset)
    for (const d of countryData) {
      d.countryIndex = i
      const cumulative = (state.normalize) ? d.normalized_value : d.value
      if (!isNaN(cumulative) && cumulative !== undefined && cumulative > 0) {
        d.y = cumulative
        if (!state.cumulative) {
          d.y -= previousValue
          previousValue = cumulative
        }
        if (!state.align) {
          d.x = d.date
        } else {
          const threshold = (state.normalize) ? ALIGN_THRESHOLD_NORMALIZED : ALIGN_THRESHOLD
          if (firstDateAboveThreshold === undefined && cumulative >= threshold) {
            firstDateAboveThreshold = d.date
          }
          if (firstDateAboveThreshold !== undefined) {
            d.x = (d.date - firstDateAboveThreshold) / MILLISECONDS_IN_A_DAY
          } else {
            d.x = undefined
          }
        }
      }
    }
    countryData = countryData.filter((d) => d.x !== undefined)
    massaged.push(countryData)
  })

  let xmax = -Infinity
  let xmin = Infinity
  let ymax = -Infinity
  let ymin = Infinity
  massaged.forEach((countryData) => {
    for (const d of countryData) {
      if (d.x > xmax) xmax = d.x
      if (d.x < xmin) xmin = d.x
      if (d.y > ymax) ymax = d.y
      if (d.y < ymin) ymin = d.y
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
      .curve(d3.curveMonotoneX)
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

}

function drawLegend ( state ) {

  const legend = d3.select('#legend > .choices')
  const tooltip = d3.select('#tooltip')
  const svg = d3.select('main > svg')

  /* collect country data */
  let allCountries = countries.getAll(state.countries, data.getCountries(state.dataset))
  allCountries = Array.from(allCountries)
  for (const c of allCountries) {
    c.idx = state.countries.findIndex((n) => n === c.country)
    c.isSelected = c.idx >= 0
  }

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

/** The main function is called when the page has loaded */
async function main () {
  state = parseUrlArgs()

  drawNav(state)

  d3.select('body').classed('loading', true)
  await countries.load()
  d3.select('body').classed('loading', false)

  onStateChange()

  window.onresize = onStateChange

  initSearch()
}

function initSearch ( ) {
  const countriesCodeMap = new Map()

  countries.forEach(function (c) {
    countriesCodeMap.set(c.code, c.country)
    countriesCodeMap.set(c.code.toLowerCase(), c.country)
  })

  const oninput = (e) => {
    const value = e.target.value

    if ( value === '*' ) {
      const allCountriesSet = data.getCountries(state.dataset)
      const allCountriesOrdered = countries.getAll(state.countries, allCountriesSet)
      state.countries = Array.from(allCountriesOrdered).map(c => c.country)
      e.target.value = ''
      onStateChange()
    }
    else if ( value === '0' ) {
      state.countries = []
      e.target.value = ''
      onStateChange()
    }
    else {
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
  }

  document.getElementById('search')
    .addEventListener(
      'input',
      functools.debounce(oninput, DELAY_DEBOUNCE_SEARCH)
    )

  document.getElementById('search')
    .addEventListener('keydown', (e) => e.stopPropagation())
}

function toggle ( key ) {
  return () => {
    state[key] = !state[key]
    onStateChange()
  }
}

const toggleCumulative = toggle('cumulative')
const toggleLog = toggle('logplot')
const toggleNormalize = toggle('normalize')
const toggleAlign = toggle('align')

function cycle ( key, values, stepsize ) {
  const oldIndex = values.indexOf(state[key])
  const newIndex = (oldIndex + stepsize + values.length) % values.length
  state[key] = values[newIndex]
  onStateChange()
}

const nextDataSet = () => cycle('dataset', data.availableDatasets(), +1)
const prevDataSet = () => cycle('dataset', data.availableDatasets(), -1)

const nextPlot = () => cyclePlots('plot', Object.keys(plots), +1)
const prevPlot = () => cyclePlots('plot', Object.keys(plots), -1)

const plot = {
  text: state => state.plot[0].toUpperCase(),
  tooltip: () => `Current plot. Available plots are: ${Object.keys(plots).join(', ')}.`,
  backgroundColor: state => {
    const keys = Object.keys(plots)
    return color(keys.indexOf(state.plot), keys.length)
  },
}

const help = {
  text: '?',
  tooltip: 'You can use URL parameters, for example: <span class="url">index.html?normalize=true&amp;logplot=true&amp;countries=China;Italy;South%20Korea</span>',
}

const plots = {
  'time' : {
    nav: [
      plot,
      help,
      {
        text: 'c',
        tooltip: 'Cumulative plot [c]',
        classList: {
          toggled: state => state.cumulative,
        },
        onClick: toggleCumulative,
      },
      {
        text: 'log',
        tooltip: 'Switch to log-plot [l]',
        classList: {
          toggled: state => state.logplot,
          disabled: state => !state.cumulative,
        },
        onClick: toggleLog,
      },
      {
        text: 'n',
        tooltip: 'Normalize by population (default) [n]',
        classList: {
          toggled: state => state.normalize,
        },
        onClick: toggleNormalize,
      },
      {
        text: 'd',
        tooltip: 'Cycle through available datasets [d]',
        style: {
          backgroundColor: state => {
            const datasets = data.availableDatasets()
            return color(datasets.indexOf(state.dataset), datasets.length)
          },
        },
        classList: {
          list: true,
        },
        onClick: nextDataSet,
      },
      {
        text: 'a',
        tooltip: state => state.normalize ?
        `Align by first day with ${ALIGN_THRESHOLD_NORMALIZED} cases per 100,000 [a]` :
        `Align by first day with ${ALIGN_THRESHOLD} cases [a]` ,
        classList: {
          toggled: state => state.align,
        },
        onClick: toggleAlign,
      }
    ] ,
    shortcuts: (event) => {
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
    },
  }
}

function fromConstantOrCallable ( x , state ) {
  return (x instanceof Function) ? x(state) : x
}

let currentShortcuts

function drawNav ( state ) {

  const plot = plots[state.plot]

  const nav = document.getElementById('nav')
  while (nav.firstChild) {
    nav.removeChild(nav.lastChild)
  }

  for ( const item of plot.nav ) {
    const button = document.createElement('div')
    const text = document.createTextNode(fromConstantOrCallable(item.text, state))
    button.appendChild(text)
    if ( item.tooltip ) {
      const tooltip = document.createElement('div')
      tooltip.innerHTML = fromConstantOrCallable(item.tooltip, state)
      button.appendChild(tooltip)
    }
    for ( const [className, test] of Object.entries(item.classList || {})) {
      if ( fromConstantOrCallable(test, state) ) {
        button.classList.add(className)
      }
    }
    for ( const [key, value] of Object.entries(item.style || {})) {
      button.style[key] = fromConstantOrCallable(value, state)
    }
    if ( item.onClick && !(item.classList && fromConstantOrCallable(item.disabled, state)) ) {
      button.addEventListener('click', item.onClick)
    }
    nav.appendChild(button)
  }

  document.removeEventListener('keydown', currentShortcuts);
  currentShortcuts = plot.shortcuts
  document.addEventListener('keydown', currentShortcuts);

}

window.onload = main
