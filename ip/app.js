import Kernel from "../core/kernel.js";

Kernel.init();

const publicIp = document.querySelector("#public-ip");
const ispValue = document.querySelector("#isp-value");
const countryValue = document.querySelector("#country-value");
const regionValue = document.querySelector("#region-value");
const sourceValue = document.querySelector("#source-value");
const userAgent = document.querySelector("#user-agent");
const rawOutput = document.querySelector("#raw-output");
const statusText = document.querySelector("#status-text");
const statusBadge = document.querySelector("#status-badge");
const signalDot = document.querySelector("#signal-dot");
const lookupButton = document.querySelector("#ip-lookup-button");
const ipInput = document.querySelector("#ip-input");
const lookupMode = document.querySelector("#lookup-mode");

const emptyValue = "nicht verfügbar";
const stateKey = "ip:lastLookup";

function setStatus(message, state = "idle") {
  statusText.textContent = message;
  statusBadge.textContent = state;
  statusBadge.className = "badge";
  signalDot.className = "signal-dot";

  if (state === "OK") {
    statusBadge.classList.add("ok");
  } else if (state === "ERROR") {
    statusBadge.classList.add("bad");
    signalDot.classList.add("bad");
  } else if (state === "FALLBACK" || state === "LOAD") {
    statusBadge.classList.add("warn");
    signalDot.classList.add("warn");
  }
}

function setText(element, value) {
  element.textContent = value || emptyValue;
}

function setLookupMode(ip) {
  lookupMode.textContent = ip
    ? `Manual Lookup: ${ip}`
    : "Auto Mode aktiv";
}

function isValidIpAddress(value) {
  const ipv4 =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  const ipv6 =
    /^(?=.*:)([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(%.+)?$/;

  return ipv4.test(value) || ipv6.test(value);
}

function getLookupIp() {
  const value = ipInput.value.trim();
  return value || null;
}

function normalizeIpapi(data) {
  return {
    ip: data.ip,
    isp: data.org || data.asn || emptyValue,
    country: data.country_name || data.country || emptyValue,
    region: data.region || emptyValue,
    source: "ipapi.co",
    raw: data,
  };
}

function normalizeIpify(data) {
  return {
    ip: data.ip,
    isp: emptyValue,
    country: emptyValue,
    region: emptyValue,
    source: "api.ipify.org",
    raw: data,
  };
}

function normalizeIpwho(data) {
  return {
    ip: data.ip,
    isp: data.connection?.isp || data.connection?.org || emptyValue,
    country: data.country || data.country_code || emptyValue,
    region: data.region || emptyValue,
    source: "ipwho.is",
    raw: data,
  };
}

async function loadPrimaryData(ip = null) {
  const endpoint = ip
    ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
    : "https://ipapi.co/json/";
  const data = await Kernel.api.fetchJSON(endpoint);

  if (!data || data.error || !data.ip) {
    throw new Error(data?.reason || "ipapi.co lieferte keine IP");
  }

  return normalizeIpapi(data);
}

async function loadFallbackData(ip = null) {
  const endpoint = ip
    ? `https://ipwho.is/${encodeURIComponent(ip)}`
    : "https://ipwho.is/";
  const data = await Kernel.api.fetchJSON(endpoint);

  if (!data || data.success === false || !data.ip) {
    throw new Error(data?.message || "ipwho.is lieferte keine IP");
  }

  return normalizeIpwho(data);
}

async function loadLastResortData() {
  const data = await Kernel.api.fetchJSON("https://api.ipify.org?format=json");

  if (!data || !data.ip) {
    throw new Error("ipify lieferte keine IP");
  }

  return normalizeIpify(data);
}

function renderData(data) {
  setText(publicIp, data.ip);
  setText(ispValue, data.isp);
  setText(countryValue, data.country);
  setText(regionValue, data.region);
  setText(sourceValue, data.source);
  rawOutput.textContent = JSON.stringify(data.raw, null, 2);
}

function renderError(error) {
  setText(publicIp, "keine Daten");
  setText(ispValue, emptyValue);
  setText(countryValue, emptyValue);
  setText(regionValue, emptyValue);
  setText(sourceValue, "keine api erreichbar");
  rawOutput.textContent = error.message;
}

function setButtonsDisabled(disabled) {
  lookupButton.disabled = disabled;
  ipInput.disabled = disabled;
}

async function loadIpData(ip = null) {
  setButtonsDisabled(true);
  const lookupIp = ip && ip.trim() ? ip.trim() : null;
  setLookupMode(lookupIp);
  Kernel.state.set(stateKey, { ip: lookupIp });

  if (lookupIp && !isValidIpAddress(lookupIp)) {
    renderError(new Error("ungültige IP-Adresse"));
    setStatus("ungültige IP-Adresse", "ERROR");
    setButtonsDisabled(false);
    return;
  }

  setStatus("lade Daten ...", "LOAD");
  setText(publicIp, "lade ...");
  rawOutput.textContent = "warte auf api ...";

  try {
    const data = await loadPrimaryData(lookupIp);
    renderData(data);
    setStatus(lookupIp ? "manuelle IP geladen" : "eigene IP geladen", "OK");
  } catch (primaryError) {
    try {
      setStatus("primäre API nicht verfügbar, Fallback ...", "FALLBACK");
      const fallbackData = await loadFallbackData(lookupIp);
      renderData(fallbackData);
      rawOutput.textContent = JSON.stringify(
        {
          fallback: fallbackData.raw,
          primaryError: primaryError.message,
        },
        null,
        2
      );
      setStatus("Fallback geladen", "FALLBACK");
    } catch (geoFallbackError) {
      if (lookupIp) {
        renderError(geoFallbackError);
        rawOutput.textContent = JSON.stringify(
          {
            primaryError: primaryError.message,
            geoFallbackError: geoFallbackError.message,
          },
          null,
          2
        );
        setStatus("keine Daten für manuelle IP", "ERROR");
        return;
      }

      try {
        const lastResortData = await loadLastResortData();
        renderData(lastResortData);
        rawOutput.textContent = JSON.stringify(
          {
            fallback: lastResortData.raw,
            primaryError: primaryError.message,
            geoFallbackError: geoFallbackError.message,
          },
          null,
          2
        );
        setStatus("IP-Fallback geladen", "FALLBACK");
      } catch (fallbackError) {
        renderError(fallbackError);
        setStatus("keine Daten verfügbar", "ERROR");
      }
    }
  } finally {
    setButtonsDisabled(false);
  }
}

userAgent.textContent = navigator.userAgent || emptyValue;
lookupButton.addEventListener("click", () => loadIpData(getLookupIp()));
ipInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadIpData(getLookupIp());
  }
});

const payload = Kernel.router.getPayload();
if (payload?.ip) {
  ipInput.value = payload.ip;
  Kernel.router.clearPayload();
  loadIpData(payload.ip);
} else {
  loadIpData(null);
}
