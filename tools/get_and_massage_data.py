#!/usr/bin/env python3

import json
import sys
from datetime import datetime

import pandas as pd

jh_countries = None

# Download and massage Johns Hopkins data
def massage_jh_data(url):
    global jh_countries
    df = pd.read_csv(url)
    df = df.drop(columns=["Lat", "Province/State", "Long"]).transpose()
    df.reset_index(level=0, inplace=True)
    df.columns = df.iloc[0]
    df = df.iloc[1:]
    df = df.rename(columns={"Country/Region": "Date"})
    df.set_index("Date")

    # Combine different provinces of same country:
    df = df.groupby(df.columns, axis=1).sum()

    # Convert date to new format
    FMT = "%m/%d/%y"
    newFMT = "%Y-%m-%d"
    df["Date"] = df["Date"].map(lambda x: datetime.strptime(x, FMT).strftime(newFMT))
    if jh_countries is None:
        jh_countries = set(df.columns) - set(["Date"])
    df = df.loc[:, ["Date"] + sorted(jh_countries)]
    return df


types = ["Confirmed", "Deaths", "Recovered"]
jh_data = dict()
for t in types:
    url = f"https://github.com/CSSEGISandData/COVID-19/raw/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-{t}.csv"
    print(f"Downloading {url}...", file=sys.stderr)
    jh_data[t] = massage_jh_data(url)


# Download and massage population data
url = "https://github.com/datasets/population/raw/master/data/population.csv"
print(f"Downloading {url}...", file=sys.stderr)
pop = pd.read_csv(url)
pop = pop.loc[pop["Year"] == 2016]
pop.pop("Year")

# Read mapping from Johns Hopkins country names to population.csv country names
mapping = json.loads(
    """
{
  "Brunei": "Brunei Darussalam",
  "Congo (Kinshasa)": "Congo, Dem. Rep.",
  "Cruise Ship": null,
  "Czechia": "Czech Republic",
  "Egypt": "Egypt, Arab Rep.",
  "Eswatini": "Swaziland",
  "French Guiana": null,
  "Guadeloupe": null,
  "Guernsey": null,
  "Holy See": null,
  "Iran": "Iran, Islamic Rep.",
  "Jersey": null,
  "Korea, South": "Korea, Rep.",
  "Martinique": null,
  "North Macedonia": "Macedonia, FYR",
  "Reunion": null,
  "Russia": "Russian Federation",
  "Saint Lucia": "St. Lucia",
  "Saint Vincent and the Grenadines": "St. Vincent and the Grenadines",
  "Slovakia": "Slovak Republic",
  "Taiwan*": null,
  "US": "United States",
  "Venezuela": "Venezuela, RB",
  "occupied Palestinian territory": null
}
"""
)

# Rename countries in population.csv
for k, v in mapping.items():
    if k is not None and v is not None:
        pop = pop.replace(v, k)

# Drop countries not listed in Johns Hopkins data
pop = pop.loc[pop["Country Name"].isin(jh_countries)]


all_countries = set(str(c) for c in list(pop["Country Name"]))


def pop_of_country(c):
    if c not in all_countries:
        return None
    else:
        return int(pop.loc[pop["Country Name"] == c]["Value"])


def country_code(c):
    if c not in all_countries:
        return None
    else:
        return str(pop.loc[pop["Country Name"] == c]["Country Code"].values[0])


def countrymeta(c):
    return {
        "Population": pop_of_country(c),
        "Country Code": country_code(c),
    }


def join_time_series():
    joined_data = []
    for x in sorted(list(jh_data["Confirmed"]["Date"])):
        d = {"Date": x}
        for t, df in jh_data.items():
            d[f"jh_{t}"] = df.loc[df["Date"] == x].to_dict()
            d[f"jh_{t}"].pop("Date")
            d[f"jh_{t}"] = dict(
                (k, int(list(v.values())[0])) for k, v in d[f"jh_{t}"].items()
            )
        joined_data.append(d)
    return joined_data


data = {
    "Country information": dict((c, countrymeta(c)) for c in sorted(jh_countries)),
    "Time series": join_time_series(),
}
with sys.stdout as f:
    json.dump(data, f, indent=2)
