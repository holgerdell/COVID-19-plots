import * as data from './data.js'

const defaultCountries = [
  'United States', 'China', 'Italy', 'Denmark', 'Germany', 'Sweden', 'France'
]

/* This dictionary holds the default values for the state
 * new toggles and options can simply be added here */
export const state = {
  plot: 'calendar',
  colorScheme: 'light',
  dataset: data.defaultDataset,
  countries: defaultCountries,
  align: 'FULL',
  params: {
    calendar: {
      cumulative: false,
      normalize: true,
      logplot: false,
      smooth: true,
      zoom: true
    },
    trajectory: {
      normalize: true,
      logplot: true,
      smooth: true
    },
    reproduction_number: {
      zoom: true,
      smooth: true
    }
  }
}
