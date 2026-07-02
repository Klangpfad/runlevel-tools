import Kernel from "../core/kernel.js";

Kernel.init();

const form = document.querySelector("#weather-form");
const locationInput = document.querySelector("#location-input");
const statusText = document.querySelector("#status-text");
const statusBadge = document.querySelector("#status-badge");
const signalDot = document.querySelector("#signal-dot");
const temperature = document.querySelector("#temperature");
const weatherDescription = document.querySelector("#weather-description");
const locationLabel = document.querySelector("#location-label");
const windValue = document.querySelector("#wind-value");
const humidityValue = document.querySelector("#humidity-value");
const sourceValue = document.querySelector("#source-value");
const updatedValue = document.querySelector("#updated-value");
const forecastList = document.querySelector("#forecast-list");
const temperatureChart = document.querySelector("#temperature-chart");
const rawOutput = document.querySelector("#raw-output");
const locationMap = document.querySelector("#location-map");
const quickActions = document.querySelectorAll("[data-location]");
const stateKey = "weather:lastLookup";

const fallbackLocation = {
  name: "Wuppertal",
  country: "Deutschland",
  latitude: 51.2562,
  longitude: 7.1508,
  source: "Fallback-Koordinaten",
};

const weatherCodes = {
  0: "Klarer Himmel",
  1: "Ueberwiegend klar",
  2: "Teilweise bewoelkt",
  3: "Bedeckt",
  45: "Nebel",
  48: "Reifnebel",
  51: "Leichter Nieselregen",
  53: "Nieselregen",
  55: "Starker Nieselregen",
  56: "Leichter gefrierender Nieselregen",
  57: "Gefrierender Nieselregen",
  61: "Leichter Regen",
  63: "Regen",
  65: "Starker Regen",
  66: "Leichter gefrierender Regen",
  67: "Gefrierender Regen",
  71: "Leichter Schneefall",
  73: "Schneefall",
  75: "Starker Schneefall",
  77: "Schneekoerner",
  80: "Leichte Regenschauer",
  81: "Regenschauer",
  82: "Starke Regenschauer",
  85: "Leichte Schneeschauer",
  86: "Starke Schneeschauer",
  95: "Gewitter",
  96: "Gewitter mit Hagel",
  99: "Starkes Gewitter mit Hagel",
};

function setStatus(message, state = "idle") {
  statusText.textContent = message;
  statusBadge.textContent = state;
  statusBadge.className = "badge";
  signalDot.className = "signal-dot";

  if (state === "OK") {
    statusBadge.classList.add("ok");
  } else if (state === "FALLBACK" || state === "LOAD") {
    statusBadge.classList.add("warn");
    signalDot.classList.add("warn");
  } else if (state === "ERROR") {
    statusBadge.classList.add("bad");
    signalDot.classList.add("bad");
  }
}

async function geocodeLocation(query) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "de");
  url.searchParams.set("format", "json");

  const data = await Kernel.api.fetchJSON(url);
  const match = data.results?.[0];

  if (!match) {
    throw new Error("Ort nicht gefunden");
  }

  return {
    name: match.name,
    country: match.country,
    latitude: match.latitude,
    longitude: match.longitude,
    source: "Open-Meteo Geocoding",
  };
}

async function fetchWeather(location) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", location.latitude);
  url.searchParams.set("longitude", location.longitude);
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  return Kernel.api.fetchJSON(url);
}

function formatTemperature(value) {
  if (typeof value !== "number") {
    return "-";
  }

  return `${Math.round(value)} °C`;
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function renderForecast(daily) {
  if (!daily?.time?.length) {
    forecastList.innerHTML = '<p class="empty">Keine Vorschau verfügbar.</p>';
    return;
  }

  forecastList.innerHTML = daily.time
    .map((day, index) => {
      return `
        <div class="forecast-row">
          <strong>${formatDate(day)}</strong>
          <span>min ${formatTemperature(daily.temperature_2m_min[index])}</span>
          <span>max ${formatTemperature(daily.temperature_2m_max[index])}</span>
        </div>
      `;
    })
    .join("");
}

function hasTemperatureChartData(daily) {
  return daily?.time?.length
    && daily.temperature_2m_min?.length
    && daily.temperature_2m_max?.length;
}

function renderTemperatureChart(daily) {
  if (!hasTemperatureChartData(daily)) {
    temperatureChart.innerHTML = '<p class="empty">Keine Temperaturdaten verfügbar.</p>';
    return;
  }

  const points = daily.time
    .map((day, index) => ({
      day,
      min: daily.temperature_2m_min[index],
      max: daily.temperature_2m_max[index],
    }))
    .filter((point) => typeof point.min === "number" && typeof point.max === "number");

  if (!points.length) {
    temperatureChart.innerHTML = '<p class="empty">Keine Temperaturdaten verfügbar.</p>';
    return;
  }

  const width = 720;
  const height = 280;
  const padding = { top: 26, right: 28, bottom: 54, left: 48 };
  const values = points.flatMap((point) => [point.min, point.max]);
  const minValue = Math.floor(Math.min(...values) - 1);
  const maxValue = Math.ceil(Math.max(...values) + 1);
  const valueRange = Math.max(maxValue - minValue, 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const xFor = (index) => padding.left + xStep * index;
  const yFor = (value) => padding.top + ((maxValue - value) / valueRange) * plotHeight;
  const buildPolyline = (key) => points
    .map((point, index) => `${xFor(index).toFixed(1)},${yFor(point[key]).toFixed(1)}`)
    .join(" ");

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = padding.top + plotHeight * ratio;
    const label = Math.round(maxValue - valueRange * ratio);

    return `
      <line class="chart-grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>
      <text class="chart-axis-label" x="${padding.left - 10}" y="${y + 4}" text-anchor="end">${label}°</text>
    `;
  }).join("");

  const dayMarkers = points.map((point, index) => {
    const x = xFor(index);
    const minY = yFor(point.min);
    const maxY = yFor(point.max);

    return `
      <g class="chart-day">
        <text class="chart-value chart-value-max" x="${x}" y="${maxY - 10}" text-anchor="middle">${Math.round(point.max)}°</text>
        <circle class="chart-point chart-point-max" cx="${x}" cy="${maxY}" r="4.5"></circle>
        <text class="chart-value chart-value-min" x="${x}" y="${minY + 20}" text-anchor="middle">${Math.round(point.min)}°</text>
        <circle class="chart-point chart-point-min" cx="${x}" cy="${minY}" r="4.5"></circle>
        <text class="chart-axis-label chart-date" x="${x}" y="${height - 20}" text-anchor="middle">${formatDate(point.day)}</text>
      </g>
    `;
  }).join("");

  temperatureChart.innerHTML = `
    <div class="chart-legend" aria-hidden="true">
      <span><i class="legend-line legend-line-max"></i>Max Temperatur</span>
      <span><i class="legend-line legend-line-min"></i>Min Temperatur</span>
    </div>
    <svg class="temperature-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="temperature-chart-title temperature-chart-desc" preserveAspectRatio="none">
      <desc id="temperature-chart-desc">Temperaturkurve der Tageshöchst- und Tagestiefstwerte für sieben Tage.</desc>
      ${gridLines}
      <polyline class="chart-line chart-line-max" points="${buildPolyline("max")}"></polyline>
      <polyline class="chart-line chart-line-min" points="${buildPolyline("min")}"></polyline>
      ${dayMarkers}
    </svg>
  `;
}

function hasLocationCoordinates(location) {
  return typeof location?.latitude === "number" && typeof location.longitude === "number";
}

function formatCoordinate(value) {
  return value.toFixed(4);
}

function renderLocationMap(location) {
  if (!hasLocationCoordinates(location)) {
    locationMap.innerHTML = '<p class="empty">Keine Standortdaten verfügbar.</p>';
    return;
  }

  const { latitude, longitude } = location;
  const delta = 0.045;
  const mapUrl = new URL("https://www.openstreetmap.org/export/embed.html");
  mapUrl.searchParams.set("bbox", [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join(","));
  mapUrl.searchParams.set("layer", "mapnik");
  mapUrl.searchParams.set("marker", `${latitude},${longitude}`);

  const osmUrl = new URL("https://www.openstreetmap.org/");
  osmUrl.searchParams.set("mlat", latitude);
  osmUrl.searchParams.set("mlon", longitude);
  osmUrl.hash = `map=12/${latitude}/${longitude}`;

  locationMap.innerHTML = `
    <div class="map-frame">
      <iframe
        title="OpenStreetMap Standortkarte"
        src="${mapUrl.toString()}"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade">
      </iframe>
    </div>
    <p class="map-coordinates">Lat ${formatCoordinate(latitude)} · Lon ${formatCoordinate(longitude)}</p>
    <a class="map-link" href="${osmUrl.toString()}" target="_blank" rel="noopener noreferrer">In OpenStreetMap öffnen</a>
  `;
}

function renderWeather(location, weather, state) {
  const current = weather.current || {};
  const description = weatherCodes[current.weather_code] || "Wettercode unbekannt";

  temperature.textContent = formatTemperature(current.temperature_2m);
  weatherDescription.textContent = description;
  locationLabel.textContent = `${location.name}, ${location.country}`;
  windValue.textContent = typeof current.wind_speed_10m === "number"
    ? `${Math.round(current.wind_speed_10m)} km/h`
    : "-";
  humidityValue.textContent = typeof current.relative_humidity_2m === "number"
    ? `${current.relative_humidity_2m} %`
    : "-";
  sourceValue.textContent = state === "FALLBACK" ? location.source : "Open-Meteo";
  updatedValue.textContent = current.time
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(current.time))
    : "-";
  renderForecast(weather.daily);
  renderTemperatureChart(weather.daily);
  renderLocationMap(location);
  rawOutput.textContent = JSON.stringify({ location, weather }, null, 2);
}

function renderError(error) {
  temperature.textContent = "-- °C";
  weatherDescription.textContent = "Keine Wetterdaten verfügbar.";
  locationLabel.textContent = "Abfrage fehlgeschlagen";
  windValue.textContent = "-";
  humidityValue.textContent = "-";
  sourceValue.textContent = "-";
  updatedValue.textContent = "-";
  forecastList.innerHTML = '<p class="empty">Keine Vorschau verfügbar.</p>';
  temperatureChart.innerHTML = '<p class="empty">Keine Temperaturdaten verfügbar.</p>';
  locationMap.innerHTML = '<p class="empty">Keine Standortdaten verfügbar.</p>';
  rawOutput.textContent = error.message;
}

async function loadWeather(event) {
  event?.preventDefault();
  const query = locationInput.value.trim() || fallbackLocation.name;
  Kernel.state.set(stateKey, { location: query });

  setStatus("lade Wetterdaten ...", "LOAD");
  rawOutput.textContent = "warte auf api ...";

  try {
    const location = await geocodeLocation(query);
    const weather = await fetchWeather(location);
    renderWeather(location, weather, "OK");
    setStatus("Daten geladen", "OK");
  } catch (primaryError) {
    try {
      const weather = await fetchWeather(fallbackLocation);
      renderWeather(fallbackLocation, weather, "FALLBACK");
      rawOutput.textContent = JSON.stringify(
        {
          fallbackLocation,
          primaryError: primaryError.message,
          weather,
        },
        null,
        2
      );
      setStatus("fallback geladen", "FALLBACK");
    } catch (fallbackError) {
      renderError(fallbackError);
      setStatus("keine Daten verfügbar", "ERROR");
    }
  }
}

quickActions.forEach((button) => {
  button.addEventListener("click", () => {
    locationInput.value = button.dataset.location;
    form.requestSubmit();
  });
});

form.addEventListener("submit", loadWeather);

const payload = Kernel.router.getPayload();
if (payload?.location) {
  locationInput.value = payload.location;
  Kernel.router.clearPayload();
  loadWeather();
} else {
  const previous = Kernel.state.get(stateKey);
  if (previous?.location) {
    locationInput.value = previous.location;
  }
  loadWeather();
}
