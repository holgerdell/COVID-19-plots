/* COVID-19-plots.js | MIT License | github.com/holgerdell/COVID-19-plots */

import { getState } from './state.js'
import { drawNav, drawPlot, drawLegend, updateColorScheme } from './draw.js'
import plots from './plots.js'
import * as countries from './countries.js'
import * as search from './search.js'

/** This function is called when the model state has changed.
  * Its purpose is to update the view state.
 */
async function onStateChange () {
  console.debug('onStateChange')
  const state = getState()
  const plot = plots[state.plot]

  if (plot.fixState && plot.fixState(state)) return

  d3.select('#tooltip').style('visibility', 'hidden')
  updateColorScheme(state)
  drawNav(state)
  await drawPlot(state) // timeSeriesData is loaded here
  drawLegend(state) // requires timeSeriesData to be loaded
}

/** The main function is called when the page has loaded */
async function main () {
  const state = getState()
  updateColorScheme(state)
  drawNav(state)

  d3.select('body').classed('loading', true)
  await countries.load()
  d3.select('body').classed('loading', false)

  onStateChange()

  window.onresize = onStateChange
  window.addEventListener('hashchange', onStateChange)

  search.init()
}

window.onload = main
