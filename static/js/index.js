const serverBaseURL = "http://127.0.0.1:5000";
const apiBaseURL = `${serverBaseURL}/api`;
const apiCurrentVersion = "v1.0";

/**
 * Global variables for the state of the page.
 */
let state = {
  pieCharts: [],
  map: {},
  year: "",
  caseMarkers: {},
};

/**
 * HTML elements on the page as d3 objects.
 */
const elements = {
  divLoading: d3.select(".loading"),
  divMap: d3.select("#mapid"),
  divPieChartRace: d3.select(".chart--race"),
  divPieChartSex: d3.select(".chart--sex"),
  divChartBar: d3.select(".chart--bar"),
  selectYear: d3.select("#selectYear"),
  buttonApplySettings: d3.select("#buttonApplySettings"),
  divChartRowList: d3.selectAll(".row__charts"),
  divChartColRace: d3.select(".col__chart-race"),
  divChartColSex: d3.select(".col__chart-sex"),
};

/**
 * This error will be thrown when
 * there is no data to make a chart out of.
 */
class NoDataError extends Error {
  /**
   * Creates an error for when there's no data
   * to make a chart from.
   * @param {string} message
   * Message to display.
   */
  constructor(message) {
    super(message);
    this.name = "NoDataError";
  }
}

/**
 * Sets a sleep timer.
 *
 * From: https://stackoverflow.com/questions/33289726/combination-of-async-function-await-settimeout
 *
 * @param {int} m Time in millseconds
 */
const sleep = (m) => new Promise((r) => setTimeout(r, m));

/**
 * Main application logic.
 */
async function main() {
  await showLoading();
  bindHandlers();

  try {
    state.map = makeMap();

    const streetLayer = makeStreetTileLayer();
    streetLayer.addTo(state.map);

    const availableYears = await loadAvailableYears();
    populateSelectYears(availableYears);
  } finally {
    hideLoading();
  }
}

main();

/**
 * Binds all handlers to their elements.
 */
function bindHandlers() {
  elements.buttonApplySettings.on("click", onApplySettings);
}

/**
 * Handler for applying settings.
 */
async function onApplySettings() {
  d3.event.preventDefault();

  await showLoading();
  hideChartRows();
  clearData();

  try {
    const selectElement = elements.selectYear;
    const selectedOption = selectElement.property("value");
    console.log(selectedOption);

    if (selectedOption != "None") {
      const selectedYear = selectedOption;
      await updateCasesByYear(selectedYear);
      state.year = selectedYear;
      showChartRows();
    }
  } finally {
    hideLoading();
  }
}

/**
 * Clears data from page.
 */
function clearData() {
  state.year = "";
  clearCharts();
  state.map.removeLayer(state.caseMarkers);
}

/**
 * Clears all charts.
 */
function clearCharts() {
  let pieCharts = state.pieCharts;
  pieCharts.forEach((chart) => chart.dispose());
  state.pieCharts = [];
}

/**
 * Populates the select years element with options.
 *
 * @param {string[]} options
 * The options to add to the element.
 */
function populateSelectYears(options) {
  const selectElement = elements.selectYear;
  options.forEach((option) => {
    const optionElement = selectElement.append("option");
    optionElement.text(option);
  });
}

/**
 * Updates the page with cases from a specified year.
 *
 * @param {int} year
 * The year to load cases from.
 */
async function updateCasesByYear(year) {
  const allCasesByYear = await loadCasesByYear(year);
  console.log(allCasesByYear);

  const caseMarkers = createCaseClustersMarkers(allCasesByYear);
  caseMarkers.addTo(state.map);
  state.caseMarkers = caseMarkers;

  am4core.ready(() => generateAmCharts(allCasesByYear, year));
}

/**
 * Hides the loading screen from the page.
 */
function hideLoading() {
  const loadingElement = elements.divLoading;
  hideElements(loadingElement);
}

/**
 * Shows the loading screen on the page.
 */
async function showLoading() {
  const loadingElement = elements.divLoading;
  showElements(loadingElement);
  await sleep(300); // Wait for cover-up animation to finish
}

/**
 * Hides all charts from the page.
 */
function hideChartRows() {
  const chartRowElements = elements.divChartRowList;
  hideElements(chartRowElements);
}

/**
 * Shows all charts on the page.
 */
function showChartRows() {
  const chartRowElements = elements.divChartRowList;
  showElements(chartRowElements);
}

/**
 * Creates a map on the page.
 */
function makeMap() {
  const mapContainer = elements.divMap;
  // Creating Leaflet map object with maker clusters
  var myMap = L.map(mapContainer.node(), {
    center: [44.9778, -93.265],
    zoom: 13,
  });

  return myMap;
}

/**
 * Creates a street tile layer for the map.
 */
function makeStreetTileLayer() {
  // Adding tile layer
  const streetsLayer = L.tileLayer(
    "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
    {
      attribution:
        "© <a href='https://www.mapbox.com/about/maps/'>Mapbox</a> © <a href='http://www.openstreetmap.org/copyright'>OpenStreetMap</a> <strong><a href='https://www.mapbox.com/map-feedback/' target='_blank'>Improve this map</a></strong>",
      tileSize: 512,
      maxZoom: 18,
      zoomOffset: -1,
      id: "mapbox/streets-v11",
      accessToken: API_KEY,
    }
  );

  return streetsLayer;
}

/**
 * Creates a marker cluster layer from a list of cases
 * to display on the map.
 *
 * @param {any[]} cases
 * Cases to create the markers from.
 */
function createCaseClustersMarkers(cases) {
  var markers = L.markerClusterGroup();

  cases.forEach((caseInfo) => {
    const currentCase = caseInfo.case;

    const longitude = currentCase.longitude;
    const latitude = currentCase.latitude;
    const date = currentCase.date;
    const problem = currentCase.problem;

    if (longitude && latitude) {
      const marker = L.marker([latitude, longitude]);
      marker.bindPopup(
        `
        <h3>
        ${problem}
        </h3>
        <hr>
        ${date}
        `
      );
      markers.addLayer(marker);
    }
  });

  return markers;
}

/**
 * Loads all cases for the specified year from the database.
 *
 * @param {int} year
 * The year to load the cases for.
 */
async function loadCasesByYear(year) {
  const url = `${apiBaseURL}/${apiCurrentVersion}/year/${year}`;
  const allCases = await d3.json(url);
  return allCases;
}

/**
 * Loads all available years from the database.
 */
async function loadAvailableYears() {
  const url = `${apiBaseURL}/${apiCurrentVersion}/year`;
  const response = await d3.json(url);
  return response.availableYears;
}

/**
 * Generates a set of charts using amCharts.
 *
 * https://www.amcharts.com/docs/v4/
 *
 * @param {any[]} cases
 * The cases to generate the charts from.
 */
function generateAmCharts(cases) {
  am4core.useTheme(am4themes_animated);

  try {
    let racePieChart = generateRacePieChart(cases);
    showRacePieChartCard();
    state.pieCharts.push(racePieChart);
  } catch (error) {
    if (error instanceof NoDataError) {
      hideRacePieChartCard();
    } else {
      throw error;
    }
  }

  try {
    let sexPieChart = generateSexPieChart(cases);
    showSexPieChartCard();
    state.pieCharts.push(sexPieChart);
  } catch (error) {
    if (error instanceof NoDataError) {
      hideSexPieChartCard();
    } else {
      throw error;
    }
  }
}

/**
 * Shows the pie chart card on race.
 */
function showRacePieChartCard() {
  let element = elements.divChartColRace;
  showElements(element);
}

/**
 * Shows the pie chart card on sex.
 */
function showSexPieChartCard() {
  let element = elements.divChartColSex;
  showElements(element);
}

/**
 * Hides the pie chart card on race.
 */
function hideRacePieChartCard() {
  let element = elements.divChartColRace;
  hideElements(element);
}

/**
 * Hides the pie chart card on sex.
 */
function hideSexPieChartCard() {
  let element = elements.divChartColSex;
  hideElements(element);
}

/**
 * Hide one or more elements on the page.
 * @param {any} elements
 * Elements to hide as a d3 object.
 */
function hideElements(elements) {
  elements.classed("hidden", true);
}

/**
 * Shows one or more elements on the page.
 * @param {any} elements
 * Elements to hide as a d3 object.
 */
function showElements(elements) {
  elements.classed("hidden", false);
}

/**
 * Creates a pie chart using amCharts.
 * This pie chart displays the subject's races.
 *
 * @param {any[]} cases
 * The cases to generate the chart from.
 */
function generateRacePieChart(cases) {
  const chartElement = elements.divPieChartRace;

  const raceData = getRaceData(cases);
  if (raceData.length > 0) {
    var chart = generateAmPieChart(chartElement, "count", "race");
    chart.data = getRaceData(cases);
  } else {
    throw new NoDataError("No race data.");
  }

  return chart;
}

/**
 * Generates a amChart pie chart.
 *
 * @param {any} parentElement
 * Parent HTML element as a d3 object to append the chart to.
 *
 * @param {string} valueKey
 * Key within the data to bind to the pie value.
 *
 * @param {string} categoryKey
 * Key within the data to bind to the pie category.
 */
function generateAmPieChart(parentElement, valueKey, categoryKey) {
  // Create chart instance
  var chart = am4core.create(parentElement.node(), am4charts.PieChart);

  chart.legend = new am4charts.Legend();
  chart.legend.position = "right";
  chart.legend.scrollable = true;

  // Add and configure Series
  var pieSeries = chart.series.push(new am4charts.PieSeries());
  pieSeries.dataFields.value = valueKey;
  pieSeries.dataFields.category = categoryKey;
  pieSeries.labels.template.disabled = true;
  pieSeries.ticks.template.disabled = true;

  return chart;
}

/**
 * Gets all the race data from a list of cases.
 *
 * @param {any[]} cases
 * The cases to find the race data from.
 */
function getRaceData(cases) {
  let raceCount = {};
  for (let caseInfo of cases) {
    const caseData = caseInfo["case"];

    const force = caseData["force"];
    if (!force) break;

    const subject = force["subject"];
    if (!subject) break;

    race = subject["race"];
    if (race) {
      if (raceCount[race] > 0) {
        raceCount[race]++;
      } else {
        raceCount[race] = 1;
      }
    }
  }

  let raceStats = [];
  Object.entries(raceCount).forEach(([race, count]) => {
    raceStats.push({
      race: race,
      count: count,
    });
  });
  return raceStats;
}

/**
 * This pie chart displays the subject's sex.
 *
 * @param {any[]} cases
 * The cases to generate the chart from.
 */
function generateSexPieChart(cases) {
  const chartElement = elements.divPieChartSex;

  const sexData = getSexData(cases);
  if (sexData.length > 0) {
    var chart = generateAmPieChart(chartElement, "count", "sex");
    chart.data = getSexData(cases);
  } else {
    throw new NoDataError("No sex data.");
  }

  return chart;
}

/**
 * Generates a amChart pie chart.
 *
 * @param {any} parentElement
 * Parent HTML element as a d3 object to append the chart to.
 *
 * @param {string} valueKey
 * Key within the data to bind to the pie value.
 *
 * @param {string} categoryKey
 * Key within the data to bind to the pie category.
 */
function generateAmPieChart(parentElement, valueKey, categoryKey) {
  // Create chart instance
  var chart = am4core.create(parentElement.node(), am4charts.PieChart);

  chart.legend = new am4charts.Legend();
  chart.legend.position = "right";
  chart.legend.scrollable = true;

  // Add and configure Series
  var pieSeries = chart.series.push(new am4charts.PieSeries());
  pieSeries.dataFields.value = valueKey;
  pieSeries.dataFields.category = categoryKey;
  pieSeries.labels.template.disabled = true;
  pieSeries.ticks.template.disabled = true;

  return chart;
}

/**
 * Gets all the sex data from a list of cases.
 *
 * @param {any[]} cases
 * The cases to find the sex data from.
 */
function getSexData(cases) {
  let sexCount = {};
  for (let caseInfo of cases) {
    const caseData = caseInfo["case"];

    const force = caseData["force"];
    if (!force) break;

    const subject = force["subject"];
    if (!subject) break;

    sex = subject["sex"];
    if (sex) {
      if (sexCount[sex] > 0) {
        sexCount[sex]++;
      } else {
        sexCount[sex] = 1;
      }
    }
  }

  let sexStats = [];
  Object.entries(sexCount).forEach(([sex, count]) => {
    sexStats.push({
      sex: sex,
      count: count,
    });
  });
  return sexStats;
}

