import { updateState, getState } from './state.js'
import plots from './plots.js'
import * as countries from './countries.js'
import * as data from './data.js'
import color from './color.js'

/* Style configuration */
const PLOT_CIRCLE_RADIUS = 3
const PLOT_CIRCLE_HOVERRADIUS = 15
const PLOT_LINE_STROKE_WIDTH = 3

const countryColor = (d, state = getState()) => {
  const idx = (d.countryIndex !== undefined) ? d.countryIndex : d.country.countryIndex
  return color(idx, state.countries.length)
}

function getTooltip (d) {
  let html = d.country.countryName
  if (d.y !== d.value) {
    html += '<br />y: ' + d.y.toLocaleString()
  }
  html += '<br />Value: ' + d.value.toLocaleString()
  html += '<br />Date: ' + d3.timeFormat('%Y-%m-%d')(d.date)
  return html
}
export async function drawPlot (state) {
  const plot = plots[state.plot]
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

  let countryCurves = plot.curves(state)
  countryCurves = Array.from(countryCurves)
  console.log(countryCurves)

  // collect all points
  const countryPoints = []
  for (const c of countryCurves) {
    for (const p of c.curve) {
      p.country = c
      countryPoints.push(p)
    }
  }

  let xmax = -Infinity
  let xmin = Infinity
  let ymax = -Infinity
  let ymin = Infinity
  for (const p of countryPoints) {
    if (p.x > xmax) xmax = p.x
    if (p.x < xmin) xmin = p.x
    if (p.y > ymax) ymax = p.y
    if (p.y < ymin) ymin = p.y
  }
  if (!params.logplot) ymin = 0
  console.debug(`x-axis from ${xmin} to ${xmax}`)
  console.debug(`y-axis from ${ymin} to ${ymax}`)

  /* x is a function that maps data points to x-coordinates on-screen */
  const x = plot.scaleX(params, [xmin, xmax], [margin.left, width - margin.right])

  /* draw the x-axis */
  svg.selectAll('.xaxis').remove()
  svg.append('g')
    .classed('xaxis', true)
    .call(d3.axisBottom(x))
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call((g) => g.select('.tick:last-of-type text').clone()
      .attr('y', 30)
      .attr('text-anchor', 'end')
      .attr('font-weight', 'bold')
      .text(fromConstantOrCallable(plot.labelX, params, data.describe(state.dataset))))

  /* y is a function that maps data points to y-coordinates on-screen */
  const y = plot.scaleY(params, [ymin, ymax], [height - margin.bottom, margin.top])

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
      .text(fromConstantOrCallable(plot.labelY, params, data.describe(state.dataset))))

  /* Transition setting for curve movement */
  const MOVE_TRANSITION = d3.transition('move')
    .duration(0)
    .ease(d3.easeSinOut)

  svg.selectAll('g.countrypoint')
    .data(countryPoints, function (d) { return d ? d.datestring + d.country.countryName : this.id })
    .join(
      function (enter) {
        const g = enter.append('g').classed('countrypoint', true)
        g.append('circle').classed('drawarea', true)
          .style('fill', d => countryColor(d, state))
          .attr('cx', (d) => x(d.x))
          .attr('cy', (d) => y(d.y))
          .attr('r', PLOT_CIRCLE_RADIUS)
        g.append('circle').classed('hoverarea', true)
          .style('fill', 'transparent')
          .attr('cx', (d) => x(d.x))
          .attr('cy', (d) => y(d.y))
          .attr('r', PLOT_CIRCLE_HOVERRADIUS)
          .on('mouseenter', function (d) {
            d3.select(this.parentNode).select('circle.drawarea')
              .transition('expand').attr('r', 2 * PLOT_CIRCLE_RADIUS)
            tooltip.html(getTooltip(d))
            tooltip.style('visibility', 'visible')
          })
          .on('mousemove', () => {
            tooltip
              .style('top', (d3.event.pageY - 15) + 'px')
              .style('right', (document.body.offsetWidth - d3.event.pageX + 20) + 'px')
          })
          .on('mouseleave', function () {
            d3.select(this.parentNode).select('circle.drawarea')
              .transition('expand').attr('r', PLOT_CIRCLE_RADIUS)
            tooltip.style('visibility', 'hidden')
          })
        return g
      },
      function (update) {
        update.select('circle.drawarea')
          .transition(MOVE_TRANSITION)
          .style('fill', d => countryColor(d, state))
          .attr('cx', d => x(d.x))
          .attr('cy', d => y(d.y))
        update.select('circle.hoverarea')
          .attr('cx', d => x(d.x))
          .attr('cy', d => y(d.y))
        return update
      },
      exit => exit.remove()
    )

  const line = d3.line()
    .curve(d3.curveMonotoneX)
    .x(d => x(d.x))
    .y(d => y(d.y))

  svg.selectAll('path.curve')
    .data(countryCurves, function (d) { return d ? d.countryName : this.id })
    .join(
      enter => enter.append('path').classed('curve', true)
        .style('fill', 'none')
        .attr('stroke-width', PLOT_LINE_STROKE_WIDTH)
        .style('stroke', d => countryColor(d, state))
        .attr('d', d => line(d.curve)),
      update => update
        .transition(MOVE_TRANSITION)
        .style('stroke', d => countryColor(d, state))
        .attr('d', d => line(d.curve)),
      exit => exit.remove()
    )
}

export function drawLegend (state) {
  const legend = d3.select('#legend > .choices')
  const tooltip = d3.select('#tooltip')
  const svg = d3.select('main > svg')

  /* collect country data */
  let availableCountries = countries.getAll(state.countries, data.getCountries(state.dataset))
  availableCountries = Array.from(availableCountries)
  for (const c of availableCountries) {
    c.countryIndex = state.countries.findIndex(n => n === c.country)
    c.isSelected = c.countryIndex >= 0
  }

  legend.selectAll('div').data(availableCountries, c => c.country).join(
    enter => {
      const item = enter.append('div')
      item.classed('curve', true)
        .classed('selected', c => c.isSelected)
        .append('span')
        .classed('avatar', true)
        .style('background-color', c => countryColor(c, state))
        .text(c => c.code)
      item.append('span')
        .classed('label', true)
        .text(c => c.country)
      item
        .on('click', c => {
          const state = getState()
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
        .on('mouseenter', c => {
          svg.selectAll('path')
            .filter(d => (d && d.countryName === c.country))
            .transition('expand2').attr('stroke-width', 2 * PLOT_LINE_STROKE_WIDTH)
          svg.selectAll('path')
            .filter(d => (d && d.countryName !== c.country))
            .style('filter', 'grayscale(100%)')
            .style('opacity', 0.5)
          svg.selectAll('circle.drawarea')
            .filter(d => d && d.country === c.country)
            .transition('expand2').attr('r', 2 * PLOT_CIRCLE_RADIUS)
          svg.selectAll('circle.drawarea')
            .filter(d => d && d.country !== c.country)
            .style('filter', 'grayscale(100%)')
            .style('opacity', 0.5)
          tooltip.html('Population: ' + c.population.toLocaleString())
          tooltip.style('visibility', 'visible')
        })
        .on('mousemove', () => tooltip
          .style('top', (d3.event.pageY - 15) + 'px')
          .style('right', (document.body.offsetWidth - d3.event.pageX + 20) + 'px'))
        .on('mouseleave', c => {
          svg.selectAll('path')
            .filter(d => (d && d.countryName === c.country))
            .transition('expand2').attr('stroke-width', PLOT_LINE_STROKE_WIDTH)
          svg.selectAll('path')
            .filter(d => (d && d.countryName !== c.country))
            .style('filter', '')
            .style('opacity', 1)
          svg.selectAll('circle.drawarea')
            .filter(d => d && d.country === c.country)
            .transition('expand2').attr('r', PLOT_CIRCLE_RADIUS)
          svg.selectAll('circle.drawarea')
            .filter(d => d && d.country !== c.country)
            .style('filter', '')
            .style('opacity', 1)
          tooltip.style('visibility', 'hidden')
        })
    },
    update => {
      update.classed('selected', c => c.isSelected)
      update.select('span').style('background-color', c => countryColor(c, state))
      update.order()
    },
    exit => exit.remove()
  )

  // Populate datalist for search feature
  d3.select('#datalist-countries').selectAll('option').data(availableCountries, c => c.country)
    .join(
      enter => enter.append('option').attr('value', c => c.country),
      update => update,
      exit => exit.remove()
    )
}

let currentShortcuts

export function drawNav (state) {
  const plot = plots[state.plot]

  const nav = document.getElementById('nav')
  while (nav.firstChild) {
    nav.removeChild(nav.lastChild)
  }

  for (const item of plot.nav) {
    const button = document.createElement('div')
    button.classList.add('button')
    if (item.text) {
      const text = document.createTextNode(fromConstantOrCallable(item.text, state))
      button.appendChild(text)
    }
    if (item.icon) {
      const icon = document.createElement('i')
      icon.classList.add('material-icons')
      icon.innerText = fromConstantOrCallable(item.icon, state)
      button.appendChild(icon)
    }
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

export function updateColorScheme (state) {
  d3.select('body').classed('color-scheme-dark', state.colorScheme === 'dark')
  d3.select('body').classed('color-scheme-light', state.colorScheme === 'light')
}

function fromConstantOrCallable (x, arg, opt = undefined) {
  return (x instanceof Function) ? x(arg, opt) : x
}
