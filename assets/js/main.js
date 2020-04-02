/* COVID-19-plots.js | MIT License | github.com/holgerdell/COVID-19-plots */

import * as string from './lib/string.js'
import * as functools from './lib/functools.js'
import * as hash from './lib/hash.js'
import * as data from './data.js'
import * as countries from './countries.js'

const defaultCountries = [
  'China', 'Italy', 'Denmark', 'Germany', 'Sweden', 'Greece', 'France'
]

/* This dictionary holds the default values for the state
 * new toggles and options can simply be added here */
const defaultState = {
  plot: 'calendar',
  dataset: data.defaultDataset,
  countries: defaultCountries,
  params: {
    calendar: {
      align: false,
      cumulative: true,
      normalize: true,
      logplot: true,
      smooth: false
    },
    trajectory: {
      logplot: true,
      smooth: true
    }
  }
}

const getState = () => {
  const state = hash.get(defaultState)
  console.debug(state)
  return state
}
const updateState = (update) => hash.update(update)

/* Search configuration */
const DELAY_DEBOUNCE_SEARCH = 200

/* Time constants */
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

/** Get a nice label for the y-axis
  * @param {Dictionary} state is the current state
  *
  * @return {String} human-readable description of the scale of the y-axis
  */
function ylabel (state) {
  let ylabel = ''
  ylabel += string.capitalize(state.plot)
  ylabel += ' plot for '
  ylabel += data.describe(state.dataset)
  if (state.plot === 'calendar' && !state.params[state.plot].cumulative) {
    ylabel += ' per day'
  }
  if (state.params[state.plot].normalize) {
    ylabel += ' (per 100,000 inhabitants)'
  }
  ylabel += ' [dataset ' + state.dataset + ']'
  if (state.params[state.plot].logplot) {
    ylabel += ' [log-plot]'
  }
  if (state.params[state.plot].smooth) {
    ylabel += ' [smooth]'
  }
  return ylabel
}

/** This function is called when the model state has changed.
  * Its purpose is to update the view state.
 */
async function onStateChange () {
  console.debug('onStateChange')
  const state = getState()

  const logplot = state.params.calendar.logplot && state.params.calendar.cumulative // cannot be both logplot and non-cumulative ?
  if (state.plot === 'calendar' && logplot !== state.params.calendar.logplot) {
    updateState({ params: { calendar: { logplot } } })
  } else {
    d3.select('#tooltip').style('visibility', 'hidden')
    drawNav(state)
    await drawPlot(state) // timeSeriesData is loaded here
    drawLegend(state) // requires timeSeriesData to be loaded
  }
}

async function drawPlot (state) {
  const tooltip = d3.select('#tooltip')
  const params = state.params[state.plot]

  const width = document.getElementById('main').offsetWidth
  const height = document.getElementById('main').offsetHeight
  const margin = ({ top: 20, right: 20, bottom: 60, left: 50 })

  const svg = d3.select('main > svg')

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

  const countryCurves = []
  state.countries.forEach(function (c, i) {
    let firstDateAboveThreshold
    let previousValue = 0
    /* Massage the data for this country */
    let countryData = data.getTimeSeries(c, state.dataset)
    const smoothness = 3 // number of days to average on
    const buffer = []
    for (let i = 0; i < smoothness; ++i) {
      buffer.push(0)
    }
    for (const d of countryData) {
      d.countryIndex = i
      let cumulative = (params.normalize) ? d.normalized_value : d.value
      if (params.smooth) {
        buffer.splice(0, 1)
        buffer.push(cumulative)
        cumulative = buffer.reduce((x, y) => x + y) / buffer.length
      }
      if (!isNaN(cumulative) && cumulative !== undefined && cumulative > 0) {
        d.y = cumulative
        if (!params.cumulative || state.plot === 'trajectory') {
          d.y -= previousValue
          if (params.logplot) d.y = Math.max(d.y, 1)
          previousValue = cumulative
        }
        if (state.plot === 'trajectory') {
          d.x = cumulative
        } else if (!params.align) {
          d.x = d.date
        } else {
          const threshold = (params.normalize) ? ALIGN_THRESHOLD_NORMALIZED : ALIGN_THRESHOLD
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
    countryCurves.push(countryData)
  })

  let xmax = -Infinity
  let xmin = Infinity
  let ymax = -Infinity
  let ymin = Infinity
  countryCurves.forEach((countryData) => {
    for (const d of countryData) {
      if (d.x > xmax) xmax = d.x
      if (d.x < xmin) xmin = d.x
      if (d.y > ymax) ymax = d.y
      if (d.y < ymin) ymin = d.y
    }
  })
  if (!params.logplot) ymin = 0
  console.debug(`x-axis from ${xmin} to ${xmax}`)
  console.debug(`y-axis from ${ymin} to ${ymax}`)

  /* x is a function that maps Date objects to x-coordinates on-screen */
  let x = null
  if (state.plot === 'trajectory') {
    x = ((params.logplot) ? d3.scaleLog() : d3.scaleLinear())
      .domain([xmin, xmax])
      .range([margin.left, width - margin.right])
  } else if (params.align) {
    x = d3.scaleLinear()
      .domain([xmin, xmax]).nice()
      .range([margin.left, width - margin.right])
  } else {
    x = d3.scaleUtc()
      .domain([xmin, xmax])
      .range([margin.left, width - margin.right])
  }

  /* draw the x-axis */
  svg.selectAll('.xaxis').remove()
  svg.append('g')
    .classed('xaxis', true)
    .call(d3.axisBottom(x))
    .attr('transform', `translate(0,${height - margin.bottom})`)

  /* y is a function that maps values to y-coordinates on-screen */
  const y = ((params.logplot) ? d3.scaleLog() : d3.scaleLinear())
    .domain([ymin, ymax])
    .range([height - margin.bottom, margin.top])

  /* draw the y-axis */
  svg.selectAll('.yaxis').remove()
  svg.append('g')
    .classed('yaxis', true)
    .call(d3.axisLeft(y))
    .attr('transform', `translate(${margin.left},0)`)
    .call((g) => g.select('.domain').remove())
    .call((g) => g.select('.tick:last-of-type text').clone()
      .attr('x', 3)
      .attr('text-anchor', 'start')
      .attr('font-weight', 'bold')
      .text(ylabel(state)))

  /// svg.selectAll('g.curves').data(massaged, c => c[0].country)

  const countryPoints = []
  countryCurves.forEach((countryCurve, i) =>
    countryCurve.forEach((point, _) =>
      countryPoints.push(point)
    )
  )
  const circles = svg.selectAll('circle')
    .data(countryPoints)
  circles.exit().remove()
  circles.enter()
    .append('circle')
    .style('fill', e => color(e.countryIndex, state.countries.length))
    .attr('cx', (d) => x(d.x))
    .attr('cy', (d) => y(d.y))
    .attr('r', PLOT_CIRCLE_RADIUS)
    .on('mouseover', function (d, _) {
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
  circles
    .transition()
    .duration(500)
    .attr('cx', (d) => x(d.x))
    .attr('cy', (d) => y(d.y))

  const line = d3.line()
    .curve(d3.curveMonotoneX)
    .x((d) => x(d.x))
    .y((d) => y(d.y))

  const curves = svg.selectAll('path.curve').data(countryCurves)
  curves.exit().remove()
  curves.enter().append('path').classed('curve', true)
    .style('fill', 'none')
    .style('stroke', curve => color(curve[0].countryIndex, state.countries.length))
    .attr('stroke-width', PLOT_LINE_STROKE_WIDTH)
    .attr('d', line)
  curves
    .transition()
    .duration(500)
    .attr('d', line)
}

function drawLegend (state) {
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
      const update = { }
      if (c.isSelected) {
        update.countries = state.countries.filter(function (value, _) {
          return value !== c.country
        })
      } else {
        update.countries = state.countries.concat([c.country])
      }
      updateState(update)
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
  const state = getState()
  drawNav(state)

  d3.select('body').classed('loading', true)
  await countries.load()
  d3.select('body').classed('loading', false)

  onStateChange()

  window.onresize = onStateChange
  window.addEventListener('hashchange', onStateChange)

  initSearch()
}

function initSearch () {
  const countriesCodeMap = new Map()

  countries.forEach(function (c) {
    countriesCodeMap.set(c.code, c.country)
    countriesCodeMap.set(c.code.toLowerCase(), c.country)
  })

  const oninput = (e) => {
    const value = e.target.value

    if (value === '*') {
      const state = getState()
      const allCountriesSet = data.getCountries(state.dataset)
      const allCountriesOrdered = countries.getAll(state.countries, allCountriesSet)
      e.target.value = ''
      const update = { countries: Array.from(allCountriesOrdered).map(c => c.country) }
      updateState(update)
    } else if (value === '0') {
      e.target.value = ''
      updateState({ countries: [] })
    } else {
      const state = getState()
      const keys = [
        value,
        string.titlecase(value.toLowerCase()),
        string.capitalize(value.toLowerCase()),
        string.capitalizeFirstLetter(value.toLowerCase()),
        countriesCodeMap.get(value)
      ]

      for (const key of keys) {
        if (countries.getInfo(key) !== undefined) {
          const update = {}
          if (state.countries.includes(key)) {
            update.countries = state.countries.filter(
              (item) => item !== key
            )
          } else {
            update.countries = state.countries.concat([key])
          }
          e.target.value = ''
          updateState(update)
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

function toggle (key) {
  return () => {
    const state = getState()
    const update = { params: {} }
    update.params[state.plot] = {}
    update.params[state.plot][key] = !state.params[state.plot][key]
    updateState(update)
  }
}

const toggleCumulative = toggle('cumulative')
const toggleLog = toggle('logplot')
const toggleNormalize = toggle('normalize')
const toggleAlign = toggle('align')
const toggleSmooth = toggle('smooth')

function cycle (key, values, stepsize) {
  const state = getState()
  const oldIndex = values.indexOf(state[key])
  const newIndex = (oldIndex + stepsize + values.length) % values.length
  const update = { }
  update[key] = values[newIndex]
  updateState(update)
}

const nextDataSet = () => cycle('dataset', data.availableDatasets(), +1)
const prevDataSet = () => cycle('dataset', data.availableDatasets(), -1)

const nextPlot = () => cycle('plot', Object.keys(plots), +1)
const prevPlot = () => cycle('plot', Object.keys(plots), -1)

const plot = {
  text: state => state.plot[0].toUpperCase(),
  tooltip: () => `Current plot. Available plots are: ${Object.keys(plots).join(', ')}.`,
  classList: {
    list: true
  },
  style: {
    backgroundColor: state => {
      const values = Object.keys(plots)
      return color(values.indexOf(state.plot), values.length)
    }
  },
  onClick: nextPlot
}

const help = {
  text: '?',
  tooltip: 'You can use URL parameters, for example: <span class="url">index.html?normalize=true&amp;logplot=true&amp;countries=China;Italy;South%20Korea</span>'
}

const plots = {
  calendar: {
    nav: [
      plot,
      help,
      {
        text: 'c',
        tooltip: 'Cumulative plot [c]',
        classList: {
          toggled: state => state.params.calendar.cumulative
        },
        onClick: toggleCumulative
      },
      {
        text: 'log',
        tooltip: 'Switch to log-plot [l]',
        classList: {
          toggled: state => state.params.calendar.logplot,
          disabled: state => !state.params.calendar.cumulative
        },
        onClick: toggleLog
      },
      {
        text: 'n',
        tooltip: 'Normalize by population (default) [n]',
        classList: {
          toggled: state => state.params.calendar.normalize
        },
        onClick: toggleNormalize
      },
      {
        text: 'd',
        tooltip: 'Cycle through available datasets [d]',
        style: {
          backgroundColor: state => {
            const datasets = data.availableDatasets()
            return color(datasets.indexOf(state.dataset), datasets.length)
          }
        },
        classList: {
          list: true
        },
        onClick: nextDataSet
      },
      {
        text: 'a',
        tooltip: state => state.params.calendar.normalize
          ? `Align by first day with ${ALIGN_THRESHOLD_NORMALIZED} cases per 100,000 [a]`
          : `Align by first day with ${ALIGN_THRESHOLD} cases [a]`,
        classList: {
          toggled: state => state.params.calendar.align
        },
        onClick: toggleAlign
      },
      {
        text: 's',
        tooltip: 'Take average of last three measurements [s]',
        classList: {
          toggled: state => state.params.calendar.smooth
        },
        onClick: toggleSmooth
      }
    ],
    shortcuts: (event) => {
      if (!event.ctrlKey && !event.altKey) {
        switch (event.key) {
          case 'p': nextPlot(); break
          case 'P': prevPlot(); break
          case 'c': toggleCumulative(); break
          case 'l': toggleLog(); break
          case 'n': toggleNormalize(); break
          case 'd': nextDataSet(); break
          case 'D': prevDataSet(); break
          case 'a': toggleAlign(); break
          case 's': toggleSmooth(); break
        }
      }
    }
  },
  trajectory: {
    nav: [
      plot,
      help,
      {
        text: 'log',
        tooltip: 'Switch to log-plot [l]',
        classList: {
          toggled: state => state.params.trajectory.logplot
        },
        onClick: toggleLog
      },
      {
        text: 'd',
        tooltip: 'Cycle through available datasets [d]',
        style: {
          backgroundColor: state => {
            const datasets = data.availableDatasets()
            return color(datasets.indexOf(state.dataset), datasets.length)
          }
        },
        classList: {
          list: true
        },
        onClick: nextDataSet
      },
      {
        text: 's',
        tooltip: 'Take average of last three measurements [s]',
        classList: {
          toggled: state => state.params.trajectory.smooth
        },
        onClick: toggleSmooth
      }
    ],
    shortcuts: (event) => {
      if (!event.ctrlKey && !event.altKey) {
        switch (event.key) {
          case 'p': nextPlot(); break
          case 'P': prevPlot(); break
          case 'l': toggleLog(); break
          case 'n': toggleNormalize(); break
          case 'd': nextDataSet(); break
          case 'D': prevDataSet(); break
          case 's': toggleSmooth(); break
        }
      }
    }
  }
}

function fromConstantOrCallable (x, state) {
  return (x instanceof Function) ? x(state) : x
}

let currentShortcuts

function drawNav (state) {
  const plot = plots[state.plot]

  const nav = document.getElementById('nav')
  while (nav.firstChild) {
    nav.removeChild(nav.lastChild)
  }

  for (const item of plot.nav) {
    const button = document.createElement('div')
    const text = document.createTextNode(fromConstantOrCallable(item.text, state))
    button.appendChild(text)
    if (item.tooltip) {
      const tooltip = document.createElement('div')
      tooltip.innerHTML = fromConstantOrCallable(item.tooltip, state)
      button.appendChild(tooltip)
    }
    for (const [className, test] of Object.entries(item.classList || {})) {
      if (fromConstantOrCallable(test, state)) {
        button.classList.add(className)
      }
    }
    for (const [key, value] of Object.entries(item.style || {})) {
      button.style[key] = fromConstantOrCallable(value, state)
    }
    if (item.onClick && !(item.classList && fromConstantOrCallable(item.disabled, state))) {
      button.addEventListener('click', item.onClick)
    }
    nav.appendChild(button)
  }

  document.removeEventListener('keydown', currentShortcuts)
  currentShortcuts = plot.shortcuts
  document.addEventListener('keydown', currentShortcuts)
}

window.onload = main
