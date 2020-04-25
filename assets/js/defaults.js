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
      align: false,
      cumulative: true,
      normalize: true,
      logplot: true,
      smooth: false
    },
    trajectory: {
      normalize: true,
      logplot: true,
      smooth: true
    },
    doubling: {
      smooth: true
    }
  }
}
