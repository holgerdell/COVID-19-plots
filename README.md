# COVID-19 plots

Some plots. Parameters can be shared using the URL. Pull requests welcome.

For example: Compare confirmed deaths in China, United States, and Italy in a per-capita log-plot over time:
<https://holgerdell.github.io/COVID-19-plots/#%7B%22params%22%3A%7B%22calendar%22%3A%7B%22normalize%22%3Atrue%2C%22logplot%22%3Atrue%7D%7D%2C%22countries%22%3A%5B%22China%22%2C%22United%20States%22%2C%22Italy%22%5D%7D>

URL parameter `dataset` can be set to `owid_total_deaths` (default), `owid_total_cases`, `jh_deaths`, `jh_confirmed`, and `jh_recovered`.

# Featured plots

## Calendar plot

This is the plot you see everywhere: The x-axis shows the date and the y-axis the confirmed cases at that time.

## Trajectory plot

This plots the same data, but the x-axis shows the total number of confirmed cases while the y-axis shows the number of new cases on that day.
We took the idea for this plot from a [minutephysics video](https://youtu.be/54XLXg4fYsc) and Aatish Bhatia's [implementation of the same plot](https://aatishb.com/covidtrends/)

## Doubling time plot

The [doubling time](https://en.wikipedia.org/wiki/Doubling_time) is a key metric in any process that undergoes exponential growth. The x-axis shows the date as in the calendar plot, and the y-axis shows the number of days since the last doubling of the total number of cases has occurred.

# Development

Install the development tools:
```bash
yarn install
```

Start a http server for local development:
```bash
yarn run http-server
```

Manually run the JavaScript linter [standard](https://standardjs.com/):
```bash
yarn run standard
```

Manually run the CSS linter [stylelint](https://stylelint.io/):
```bash
yarn run stylelint "**/*.css"
```

Both linters support `--fix` for automatic fixing.

Visual Studio Code provides the extensions [chenxsan.vscode-standardjs](https://marketplace.visualstudio.com/items?itemName=chenxsan.vscode-standardjs) and [stylelint.vscode-stylelint](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) for automatic linting.


# Data Sources:

- Our World in Data <https://ourworldindata.org/coronavirus-source-data> (which, in turn, is sourced from [European Centre for Disease Prevention and Control (ECDC)](https://www.ecdc.europa.eu/en/coronavirus))
- Johns Hopkins University <https://github.com/CSSEGISandData/COVID-19>
- <https://github.com/datasets/population/>
