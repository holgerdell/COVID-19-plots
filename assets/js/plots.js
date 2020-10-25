/* COVID-19-plots.js | MIT License | github.com/holgerdell/COVID-19-plots */

import { getState, updateState } from './state.js'
import * as data from './data.js'
import * as countries from './countries.js' // number of days to average on
import color from './color.js'

/* Time constants */
const MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24

/* Align curve threshold */
const ALIGN_THRESHOLD_NORMALIZED = 0.1 // align to first day >= 0.1 cases per 100,000
const ALIGN_THRESHOLD = 100 // align to first day with >= 100 cases
const ALIGN_MODES = ['LAST_28_DAYS', 'FULL', 'FIRST_ABOVE_THRESHOLD']

const SMOOTHNESS_PARAMETER = 7

const REPRODUCTION_WINDOW = 7

function setField (points, source = 'value', target = 'y') {
  for (const d of points) {
    d[target] = d[source]
  }
}

function multiply (points, field = 'y', factor = 1) {
  for (const d of points) {
    d[field] = d[field] * factor
  }
}

/* given a sequence of d with a field d.field, smoothen the d.field value */
function smoothen (points, field = 'y', smoothness = SMOOTHNESS_PARAMETER) {
  const buffer = []
  for (let j = 0; j < smoothness; ++j) {
    buffer.push(0)
  }
  for (const d of points) {
    buffer.splice(0, 1)
    buffer.push(d[field])
    d[field] = buffer.reduce((a, b) => a + b) / buffer.length
  }
}

/* given a sequence, divide value by value from four days ago */
function reproduction (points, field = 'y') {
  const buffer = []
  for (let j = 0; j < REPRODUCTION_WINDOW; ++j) {
    buffer.push(1)
  }
  for (const d of points) {
    buffer.push(d[field])
    if (buffer[0] >= 1) {
      d[field] = d[field] / buffer[0]
    }
    buffer.splice(0, 1)
  }
}

/* given a sequence of total cases per day, turn them into daily new cases */
function cumulativeToDeltas (points, field = 'y') {
  let prev = 0
  for (const d of points) {
    if (!isNaN(d[field]) && d[field] !== undefined) {
      [prev, d[field]] = [d[field], d[field] - prev]
    }
  }
}

function * yieldRawData (countries, dataset) {
  for (let i = 0; i < countries.length; i++) {
    yield ({
      countryName: countries[i],
      countryIndex: i,
      curve: data.getTimeSeries(countries[i], dataset)
    })
  }
}

function getFirstDateAboveThreshold (points, threshold, field = 'y') {
  for (const p of points) {
    if (p[field] >= threshold) {
      return p.date
    }
  }
  return undefined
}

function * prepareDateOrTrajectoryData (state) {
  console.debug('in plots.')
  const countryCurves = yieldRawData(state.countries, state.dataset)
  const params = state.params[state.plot]
  const startDate = new Date() - 28 * MILLISECONDS_IN_A_DAY // 28 days ago
  for (const countryData of countryCurves) {
    setField(countryData.curve, 'value', 'y')
    if (params.normalize) multiply(countryData.curve, 'y', 100000 / countries.getInfo(countryData.countryName).population)
    if (params.smooth) smoothen(countryData.curve, 'y')
    setField(countryData.curve, 'y', 'cumulative')

    const threshold = (params.normalize) ? ALIGN_THRESHOLD_NORMALIZED : ALIGN_THRESHOLD
    const firstDateAboveThreshold = getFirstDateAboveThreshold(countryData.curve, threshold, 'y')

    if (!params.cumulative || state.plot === 'trajectory') cumulativeToDeltas(countryData.curve, 'y')

    for (const d of countryData.curve) {
      if (isNaN(d.y) || d.y <= 0) d.y = undefined
      if (state.plot === 'trajectory') {
        d.x = d.cumulative
        if (isNaN(d.x) || d.x <= 0) d.x = undefined
      } else { // state.plot === 'calendar'
        switch (state.align) {
          case 'FULL':
            d.x = d.date
            break
          case 'LAST_28_DAYS':
            if (d.date >= startDate) {
              d.x = d.date
            } else {
              d.x = undefined
            }
            break
          case 'FIRST_ABOVE_THRESHOLD':
            if (d.date >= firstDateAboveThreshold) {
              d.x = (d.date - firstDateAboveThreshold) / MILLISECONDS_IN_A_DAY
            } else {
              d.x = undefined
            }
            break
          default:
            console.error(`unknown value of state.align: ${state.align}`)
            break
        }
      }
    }
    countryData.curve = countryData.curve.filter(d => d.x !== undefined && d.y !== undefined)
    yield countryData
  }
  console.debug('done with plots.')
}

function * prepareReproductionData (state) {
  const countryCurves = yieldRawData(state.countries, state.dataset)
  const params = state.params[state.plot]
  for (const countryData of countryCurves) {
    setField(countryData.curve, 'date', 'x')
    setField(countryData.curve, 'value', 'y')
    cumulativeToDeltas(countryData.curve, 'y')
    if (params.smooth) smoothen(countryData.curve, 'y')
    reproduction(countryData.curve, 'y')
    countryData.curve = countryData.curve.filter(d => d.x !== undefined && d.y !== undefined && d.y > 0)
    yield countryData
  }
}

function toggle (key) {
  return () => {
    const state = getState()
    if (state.params[state.plot][key] !== undefined) { // only toggle if parameter is defined for this plot.
      updateState({ params: { [state.plot]: { [key]: !state.params[state.plot][key] } } })
    }
  }
}

const toggleCumulative = toggle('cumulative')
const toggleLog = toggle('logplot')
const toggleNormalize = toggle('normalize')
const toggleZoom = toggle('zoom')
const toggleSmooth = toggle('smooth')

function cycle (key, values, stepsize) {
  const state = getState()
  const oldIndex = values.indexOf(state[key])
  const newIndex = (oldIndex + stepsize + values.length) % values.length
  updateState({ [key]: values[newIndex] })
}

const nextDataSet = () => cycle('dataset', data.availableDatasets(), +1)
const prevDataSet = () => cycle('dataset', data.availableDatasets(), -1)

const nextPlot = () => cycle('plot', Object.keys(plots), +1)
const prevPlot = () => cycle('plot', Object.keys(plots), -1)

const nextAlign = () => cycle('align', ALIGN_MODES, +1)
const prevAlign = () => cycle('align', ALIGN_MODES, -1)

const buttonPlot = {
  icon: state => plots[state.plot].icon,
  tooltip: state => `Current plot is '${state.plot}'. Available plots are: ${Object.keys(plots).join(', ')}. [p]`,
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

const buttonColorScheme = {
  icon: state => state.colorScheme === 'light' ? 'brightness_5' : 'brightness_2',
  tooltip: state => `Color scheme. Current: ${state.colorScheme}`,
  onClick: () => updateState({ colorScheme: getState().colorScheme === 'light' ? 'dark' : 'light' })
}

const buttonDataset = {
  icon: 'folder',
  tooltip: state => `Current dataset is '${state.dataset}'. Available datasets are: ${Object.values(data.availableDatasets()).join(', ')}. [d]`,
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
}

const buttonAlign = {
  icon: state => state.align === 'FIRST_ABOVE_THRESHOLD' ? 'call_merge' : 'call_split',
  tooltip: state => `Current alignment mode is '${state.align}'. [a]`,
  // (state.align === 'FIRST_ABOVE_THRESHOLD')
  //   ? ('<br/>In the current mode, we align by first day with ' + (state.params[state.plot].normalize
  //     ? `Align by first day with ${ALIGN_THRESHOLD_NORMALIZED} cases per 100,000 [a]`
  //     : `Align by first day with ${ALIGN_THRESHOLD} cases [a]`))
  //   : ''),
  style: {
    backgroundColor: state => {
      return color(ALIGN_MODES.indexOf(state.align), ALIGN_MODES.length)
    }
  },
  classList: {
    list: true
  },
  onClick: nextAlign
}

const buttonSmooth = {
  icon: 'gesture',
  tooltip: state => (state.params[state.plot].smooth
    ? `Disable taking average of last ${SMOOTHNESS_PARAMETER} measurements`
    : `Take average of last ${SMOOTHNESS_PARAMETER} measurements`) + ' [s]',
  classList: {
    toggled: state => state.params[state.plot].smooth
  },
  onClick: toggleSmooth
}

const buttonLogplot = {
  icon: 'linear_scale',
  tooltip: state => (state.params[state.plot].logplot
    ? 'Switch to linear scale'
    : (state.plot === 'trajectory'
      ? 'Switch to log-log-plot'
      : 'Switch to log-plot')) + ' [l]',
  classList: {
    toggled: state => state.params[state.plot].logplot
  },
  onClick: toggleLog
}

const buttonNormalize = {
  icon: 'supervisor_account',
  tooltip: state => (state.params[state.plot].normalize
    ? 'Disable normalization by population'
    : 'Normalize by population') + ' [n]',
  classList: {
    toggled: state => state.params[state.plot].normalize
  },
  onClick: toggleNormalize
}

const buttonZoom = {
  icon: state => state.params[state.plot].zoom ? 'zoom_out' : 'zoom_in',
  tooltip: state => state.params[state.plot].zoom
    ? 'Zoom out and show full y-range [z]'
    : 'Zoom in and set y-range to [0,2] [z]',
  classList: {
    toggled: state => state.params[state.plot].zoom
  },
  onClick: toggleZoom
}

const plots = {
  calendar: {
    scaleX: (params, domain, range) => getState().align === 'FIRST_ABOVE_THRESHOLD' ? d3.scaleLinear(domain, range).nice() : d3.scaleUtc(domain, range),
    scaleY: (params, domain, range) => params.logplot ? d3.scaleLog(domain, range).nice() : d3.scaleLinear(domain, range).nice(),
    labelX: (params, cases = 'cases') => (getState().align === 'FIRST_ABOVE_THRESHOLD'
      ? (params.normalize
        ? `days after ${ALIGN_THRESHOLD_NORMALIZED} ${cases} per 100,000`
        : `days after ${ALIGN_THRESHOLD} ${cases}`)
      : 'Date'),
    labelY: (params, cases = 'cases') => (params.cumulative
      ? `Total ${cases} so far`
      : `New ${cases}`) +
      (params.normalize ? ' per 100,000 inhabitants' : '') +
      (params.smooth ? ' [smooth]' : '') +
      (params.logplot ? ' [log-scale]' : '') +
      (getState().align === 'LAST_28_DAYS' ? ' [last 28 days only]' : getState().align === 'FIRST_ABOVE_THRESHOLD' ? ' [aligned]' : ''),
    curves: prepareDateOrTrajectoryData,
    icon: 'schedule',
    nav: [
      buttonColorScheme,
      buttonPlot,
      buttonDataset,
      {
        icon: 'functions',
        tooltip: 'Cumulative plot [c]',
        classList: {
          toggled: state => state.params.calendar.cumulative
        },
        onClick: toggleCumulative
      },
      buttonLogplot,
      buttonNormalize,
      buttonAlign,
      buttonSmooth
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
          case 'a': nextAlign(); break
          case 'A': prevAlign(); break
          case 's': toggleSmooth(); break
          case 'z': toggleZoom(); break
        }
      }
    }
  },
  trajectory: {
    scaleX: (params, domain, range) => params.logplot ? d3.scaleLog(domain, range).nice() : d3.scaleLinear(domain, range).nice(),
    scaleY: (params, domain, range) => params.logplot ? d3.scaleLog(domain, range).nice() : d3.scaleLinear(domain, range).nice(),
    labelX: (params, cases = 'cases') => `Total ${cases} so far` +
        (params.normalize ? ' per 100,000 inhabitants' : '') +
        (params.logplot ? ' [log-scale]' : ''),
    labelY: (params, cases = 'cases') => `New ${cases}` +
      (params.normalize ? ' per 100,000 inhabitants' : '') +
      (params.smooth ? ' [smooth]' : '') +
      (params.logplot ? ' [log-scale]' : ''),
    curves: prepareDateOrTrajectoryData,
    icon: 'trending_down',
    nav: [
      buttonColorScheme,
      buttonPlot,
      buttonDataset,
      buttonNormalize,
      buttonLogplot,
      buttonSmooth
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
  },
  reproduction_number: {
    scaleX: (params, domain, range) => d3.scaleUtc(domain, range).nice(),
    scaleY: (params, domain, range) => params.zoom ? d3.scaleLinear([0, 2], range).nice() : d3.scaleLinear(domain, range).nice(),
    labelX: (params, cases = 'cases') => 'Date',
    labelY: (params, cases = 'cases') => `Estimated reproduction number of ${cases} (new cases today / new cases ${REPRODUCTION_WINDOW} days ago)` +
      (params.smooth ? ' [smooth]' : ''),
    curves: prepareReproductionData,
    icon: 'repeat',
    nav: [
      buttonColorScheme,
      buttonPlot,
      buttonDataset,
      buttonZoom,
      buttonSmooth
    ],
    shortcuts: (event) => {
      if (!event.ctrlKey && !event.altKey) {
        switch (event.key) {
          case 'p': nextPlot(); break
          case 'P': prevPlot(); break
          case 'd': nextDataSet(); break
          case 'D': prevDataSet(); break
          case 'z': toggleZoom(); break
          case 's': toggleSmooth(); break
        }
      }
    }
  }
}

export default plots
