# COVID-19 plots

Some plots. Parameters can be chosen using the URL. Pull requests welcome.

For example:
<https://holgerdell.github.io/COVID-19-plots/index.html?normalize=true&logplot=true&countries=China;Italy;South%20Korea>

URL parameter `dataset` can be set to `owid_total_cases` (default), `owid_total_deaths`, `jh_Confirmed`, `jh_Deaths`, and `jh_Recovered`.

# Development

Install the development tools:
```bash
yarn install
```

Start a http server for local development:
```bash
yarn run http-server
```

Manually run the CSS linter:
```bash
yarn run stylelint "**/*.css"
```

Manually run the JavaScript linter:
```bash
yarn run eslint "**/*.js"
```

Visual Studio Code provides the extensions [dbaeumer.vscode-eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [stylelint.vscode-stylelint](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) for automatic linting.


# Data Sources:

- Our World in Data <https://ourworldindata.org/coronavirus-source-data> (which, in turn, is sourced from [European Centre for Disease Prevention and Control (ECDC)](https://www.ecdc.europa.eu/en/coronavirus))
- Johns Hopkins University <https://github.com/CSSEGISandData/COVID-19>
- <https://github.com/datasets/population/>
