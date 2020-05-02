import * as data from './data.js'

const defaultCountries = [
  'China', 'Italy', 'Denmark', 'Germany', 'Sweden', 'Greece', 'France'
]

/* This dictionary holds the default values for the state
 * new toggles and options can simply be added here */
export const state = {
  plot: 'calendar',
  colorScheme: 'light',
  dataset: data.defaultDataset,
  countries: defaultCountries,
  params: {
    calendar: {
      align: true,
      cumulative: false,
      normalize: true,
      logplot: true,
      smooth: true
    },
    trajectory: {
      normalize: true,
      logplot: true,
      smooth: true
    },
    reproduction_number: {
      // align: false,
      zoom: true,
      smooth: true
    }
  }
}
