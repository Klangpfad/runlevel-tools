import Kernel from "../core/kernel.js";
import { escapeHtml } from "../core/domain.js";

Kernel.init();

const form = document.querySelector("#asn-form");
const asnInput = document.querySelector("#asn-input");
const statusText = document.querySelector("#status-text");
const statusBadge = document.querySelector("#status-badge");
const signalDot = document.querySelector("#signal-dot");
const rawOutput = document.querySelector("#raw-output");
const stateKey = "asn:lastLookup";

const fields = {
  asnNumber: document.querySelector("#asn-number"),
  holder: document.querySelector("#asn-holder"),
  block: document.querySelector("#asn-block"),
  announced: document.querySelector("#asn-announced"),
  prefixTotal: document.querySelector("#prefix-total"),
  prefixV4: document.querySelector("#prefix-v4"),
  prefixV6: document.querySelector("#prefix-v6"),
  neighbourTotal: document.querySelector("#neighbour-total"),
  prefixList: document.querySelector("#prefix-list"),
  neighbourList: document.querySelector("#neighbour-list"),
  externalLinks: document.querySelector("#external-links"),
};

function normalizeAsn(value) {
  return String(value || "")
    .trim()
    .replace(/^AS/i, "")
    .trim();
}

function isValidAsn(asn) {
  if (!/^\d+$/.test(asn)) {
    return false;
  }

  const number = Number(asn);
  return Number.isInteger(number) && number > 0 && number <= 4294967295;
}

function setStatus(message, state = "idle") {
  statusText.textContent = message;
  statusBadge.textContent = state;
  statusBadge.className = "badge";
  signalDot.className = "signal-dot";

  if (state === "OK") {
    statusBadge.classList.add("ok");
  } else if (state === "LOAD" || state === "WARN") {
    statusBadge.classList.add("warn");
    signalDot.classList.add("warn");
  } else if (state === "ERROR") {
    statusBadge.classList.add("bad");
    signalDot.classList.add("bad");
  }
}

function setText(element, value) {
  element.textContent = value === null || value === undefined || value === "" ? "-" : String(value);
}

function resetOutput(message) {
  setText(fields.asnNumber, "-");
  setText(fields.holder, "-");
  setText(fields.block, "-");
  setText(fields.announced, "-");
  setText(fields.prefixTotal, "-");
  setText(fields.prefixV4, "-");
  setText(fields.prefixV6, "-");
  setText(fields.neighbourTotal, "-");
  fields.prefixList.innerHTML = `<li class="empty">${escapeHtml(message)}</li>`;
  fields.neighbourList.innerHTML = `<li class="empty">${escapeHtml(message)}</li>`;
  fields.externalLinks.innerHTML = `<span class="empty">${escapeHtml(message)}</span>`;
  rawOutput.textContent = message;
}

async function fetchRipestat(callName, asn) {
  const url = new URL(`https://stat.ripe.net/data/${callName}/data.json`);
  url.searchParams.set("resource", `AS${asn}`);

  return Kernel.api.fetchJSON(url);
}

function countPrefixes(prefixes) {
  return prefixes.reduce((counts, entry) => {
    if (entry.prefix?.includes(":")) {
      counts.v6 += 1;
    } else {
      counts.v4 += 1;
    }

    return counts;
  }, { v4: 0, v6: 0 });
}

function renderPrefixes(prefixes, error) {
  if (error) {
    fields.prefixList.innerHTML = `<li class="empty">Prefix-Daten nicht verfügbar: ${escapeHtml(error.message)}</li>`;
    return;
  }

  if (!prefixes.length) {
    fields.prefixList.innerHTML = '<li class="empty">Keine Prefixe gefunden.</li>';
    return;
  }

  fields.prefixList.innerHTML = prefixes
    .slice(0, 24)
    .map((entry) => {
      const firstTimeline = entry.timelines?.[0];
      const since = firstTimeline?.starttime
        ? new Date(firstTimeline.starttime).toLocaleDateString("de-DE")
        : "-";

      return `
        <li>
          <strong>${escapeHtml(entry.prefix)}</strong>
          <span>sichtbar seit ${escapeHtml(since)}</span>
        </li>
      `;
    })
    .join("");
}

function renderNeighbours(neighbours, error) {
  if (error) {
    fields.neighbourList.innerHTML = `<li class="empty">Nachbar-Daten nicht verfügbar: ${escapeHtml(error.message)}</li>`;
    return;
  }

  if (!neighbours.length) {
    fields.neighbourList.innerHTML = '<li class="empty">Keine Nachbarn gefunden.</li>';
    return;
  }

  fields.neighbourList.innerHTML = neighbours
    .slice(0, 12)
    .map((entry) => {
      const relation = entry.type === "left" ? "Upstream / links" : "Downstream / rechts";

      return `
        <li>
          <strong>AS${escapeHtml(entry.asn)}</strong>
          <span>${escapeHtml(relation)} · IPv4 Peers ${escapeHtml(entry.v4_peers ?? "-")} · IPv6 Peers ${escapeHtml(entry.v6_peers ?? "-")}</span>
        </li>
      `;
    })
    .join("");
}

function renderLinks(asn) {
  fields.externalLinks.innerHTML = `
    <a href="https://stat.ripe.net/AS${asn}" target="_blank" rel="noopener noreferrer">RIPEstat</a>
    <a href="https://search.dnslytics.com/bgp/as${asn}" target="_blank" rel="noopener noreferrer">DNSlytics</a>
  `;
}

function getSettledValue(result) {
  return result.status === "fulfilled" ? result.value : null;
}

function getSettledError(result) {
  return result.status === "rejected" ? result.reason : null;
}

function renderResult(asn, results) {
  const overview = getSettledValue(results.overview);
  const prefixesData = getSettledValue(results.prefixes);
  const neighboursData = getSettledValue(results.neighbours);
  const overviewError = getSettledError(results.overview);
  const prefixesError = getSettledError(results.prefixes);
  const neighboursError = getSettledError(results.neighbours);
  const overviewData = overview?.data || {};
  const prefixes = prefixesData?.data?.prefixes || [];
  const neighbours = neighboursData?.data?.neighbours || [];
  const prefixCounts = countPrefixes(prefixes);
  const neighbourCounts = neighboursData?.data?.neighbour_counts || {};

  setText(fields.asnNumber, `AS${asn}`);
  setText(fields.holder, overviewError ? "nicht verfügbar" : overviewData.holder || "-");
  setText(fields.block, overviewError
    ? "nicht verfügbar"
    : overviewData.block?.resource
      ? `${overviewData.block.resource} · ${overviewData.block.desc || ""}`
      : "-");
  setText(fields.announced, overviewError
    ? "nicht verfügbar"
    : overviewData.announced
      ? "angekündigt"
      : "nicht direkt angekündigt");
  setText(fields.prefixTotal, prefixesError ? "-" : prefixes.length);
  setText(fields.prefixV4, prefixesError ? "-" : prefixCounts.v4);
  setText(fields.prefixV6, prefixesError ? "-" : prefixCounts.v6);
  setText(fields.neighbourTotal, neighboursError ? "-" : neighbourCounts.unique ?? neighbours.length);
  renderPrefixes(prefixes, prefixesError);
  renderNeighbours(neighbours, neighboursError);
  renderLinks(asn);
  rawOutput.textContent = JSON.stringify({
    overview: overview || { error: overviewError?.message || "Abfrage fehlgeschlagen" },
    prefixes: prefixesData || { error: prefixesError?.message || "Abfrage fehlgeschlagen" },
    neighbours: neighboursData || { error: neighboursError?.message || "Abfrage fehlgeschlagen" },
  }, null, 2);
}

async function handleLookup(event) {
  event.preventDefault();

  const asn = normalizeAsn(asnInput.value);
  asnInput.value = asn ? `AS${asn}` : "";

  if (!isValidAsn(asn)) {
    const message = "Bitte eine gültige AS-Nummer eingeben.";
    resetOutput(message);
    setStatus(message, "ERROR");
    return;
  }

  Kernel.state.set(stateKey, { asn: asnInput.value });
  setStatus(`Lade RIPEstat-Daten für AS${asn} ...`, "LOAD");
  resetOutput("Abfrage läuft ...");

  const [overview, prefixes, neighbours] = await Promise.allSettled([
    fetchRipestat("as-overview", asn),
    fetchRipestat("announced-prefixes", asn),
    fetchRipestat("asn-neighbours", asn),
  ]);
  const results = { overview, prefixes, neighbours };
  const loadedCount = Object.values(results).filter((result) => result.status === "fulfilled").length;

  renderResult(asn, results);

  if (loadedCount === 3) {
    setStatus(`AS${asn} geladen`, "OK");
  } else if (loadedCount > 0) {
    setStatus(`${loadedCount} von 3 RIPEstat-Abfragen geladen`, "WARN");
  } else {
    setStatus("Keine RIPEstat-Daten verfügbar", "ERROR");
  }
}

form.addEventListener("submit", handleLookup);

const payload = Kernel.router.getPayload();
if (payload?.asn) {
  asnInput.value = payload.asn;
  Kernel.router.clearPayload();
  form.requestSubmit();
} else {
  const previous = Kernel.state.get(stateKey);
  if (previous?.asn && isValidAsn(normalizeAsn(previous.asn))) {
    asnInput.value = previous.asn;
  }
  form.requestSubmit();
}
