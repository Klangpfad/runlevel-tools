import Kernel from "../core/kernel.js";
import { cleanDomain, escapeHtml, isValidDomain } from "../core/domain.js";

Kernel.init();

const form = document.querySelector("#mail-form");
const domainInput = document.querySelector("#domain-input");
const checkButton = document.querySelector("#mail-check-button");
const statusText = document.querySelector("#status-text");
const statusBadge = document.querySelector("#status-badge");
const mxStatus = document.querySelector("#mx-status");
const spfStatus = document.querySelector("#spf-status");
const dmarcStatus = document.querySelector("#dmarc-status");
const mxRecords = document.querySelector("#mx-records");
const spfRecord = document.querySelector("#spf-record");
const dmarcRecord = document.querySelector("#dmarc-record");
const rawOutput = document.querySelector("#raw-output");
const stateKey = "mail:lastLookup";

function setStatus(message, state = "idle") {
  statusText.textContent = message;
  statusBadge.textContent = state;
  statusBadge.className = "badge";

  if (state === "OK") {
    statusBadge.classList.add("ok");
  } else if (state === "WARN") {
    statusBadge.classList.add("warn");
  } else if (state === "FAIL") {
    statusBadge.classList.add("bad");
  }
}

function setLoading() {
  mxStatus.textContent = "prüfe ...";
  spfStatus.textContent = "prüfe ...";
  dmarcStatus.textContent = "prüfe ...";
  mxRecords.innerHTML = '<li class="empty">Abfrage läuft ...</li>';
  spfRecord.textContent = "warte auf resolver ...";
  dmarcRecord.textContent = "warte auf resolver ...";
  rawOutput.textContent = "warte auf resolver ...";
}

function clearResults(message) {
  mxStatus.textContent = "nicht geprüft";
  spfStatus.textContent = "nicht geprüft";
  dmarcStatus.textContent = "nicht geprüft";
  mxRecords.innerHTML = `<li class="empty">${escapeHtml(message)}</li>`;
  spfRecord.textContent = message;
  dmarcRecord.textContent = message;
  rawOutput.textContent = message;
}

function normalizeTxt(data) {
  return String(data || "")
    .replace(/"\s+"/g, "")
    .replace(/^"|"$/g, "");
}

function getAnswers(response) {
  return response?.Answer || [];
}

function getTxtRecords(response) {
  return getAnswers(response).map((record) => normalizeTxt(record.data));
}

function findSpfRecord(response) {
  return getTxtRecords(response).find((record) => record.toLowerCase().includes("v=spf1"));
}

function findDmarcRecord(response) {
  return getTxtRecords(response).find((record) => record.toLowerCase().includes("v=dmarc1"));
}

function isNullMxRecord(record) {
  return /^0\s+\.$/.test(String(record?.data || "").trim());
}

async function lookup(domain, type) {
  const url = new URL("https://dns.google/resolve");
  url.searchParams.set("name", domain);
  url.searchParams.set("type", type);

  return Kernel.api.fetchJSON(url);
}

function renderMx(records) {
  if (records.length === 0) {
    mxRecords.innerHTML = '<li class="empty">Keine MX Records gefunden.</li>';
    return;
  }

  mxRecords.innerHTML = records
    .map((record) => {
      const value = escapeHtml(record.data || "-");
      return isNullMxRecord(record)
        ? `<li>${value} (Null-MX: Mailannahme deaktiviert)</li>`
        : `<li>${value}</li>`;
    })
    .join("");
}

function renderResult(domain, mxData, txtData, dmarcData) {
  const mxAnswers = getAnswers(mxData);
  const nullMxRecords = mxAnswers.filter(isNullMxRecord);
  const regularMxRecords = mxAnswers.filter((record) => !isNullMxRecord(record));
  const hasNullMx = nullMxRecords.length > 0;
  const hasRegularMx = regularMxRecords.length > 0;
  const spf = findSpfRecord(txtData);
  const dmarc = findDmarcRecord(dmarcData);
  const configurations = [hasRegularMx, Boolean(spf), Boolean(dmarc)];
  const found = configurations.filter(Boolean).length;

  if (hasNullMx && hasRegularMx) {
    mxStatus.textContent = "widersprüchlich";
  } else if (hasNullMx) {
    mxStatus.textContent = "Mailannahme deaktiviert";
  } else {
    mxStatus.textContent = hasRegularMx ? "Records vorhanden" : "keine Records";
  }
  spfStatus.textContent = spf ? "Konfiguration gefunden" : "nicht gefunden";
  dmarcStatus.textContent = dmarc ? "Konfiguration gefunden" : "nicht gefunden";
  renderMx(mxAnswers);
  spfRecord.textContent = spf || "Kein SPF Record gefunden.";
  dmarcRecord.textContent = dmarc || "Kein DMARC Record gefunden.";
  rawOutput.textContent = JSON.stringify(
    {
      domain,
      mx: mxData,
      txt: txtData,
      dmarc: dmarcData,
    },
    null,
    2
  );

  if (hasNullMx && hasRegularMx) {
    setStatus("Null-MX und weitere MX Records gefunden. Konfiguration prüfen.", "WARN");
  } else if (hasNullMx) {
    const details = `SPF: ${spf ? "gefunden" : "nicht gefunden"}, DMARC: ${dmarc ? "gefunden" : "nicht gefunden"}`;
    setStatus(`Mailannahme durch Null-MX deaktiviert. ${details}.`, "INFO");
  } else {
    const state = found === configurations.length ? "OK" : found > 0 ? "WARN" : "FAIL";
    setStatus(`${found} von ${configurations.length} Konfigurationen gefunden (MX, SPF, DMARC).`, state);
  }
}

async function handleLookup(event) {
  event.preventDefault();

  const domain = cleanDomain(domainInput.value);
  domainInput.value = domain;
  Kernel.state.set(stateKey, { domain });

  if (!domain) {
    setStatus("Bitte eine Domain eingeben.", "FAIL");
    clearResults("Keine Abfrage gestartet.");
    return;
  }

  if (!isValidDomain(domain)) {
    setStatus("Bitte eine gültige Domain eingeben.", "FAIL");
    clearResults("Ungültige Domain.");
    return;
  }

  checkButton.disabled = true;
  setStatus(`Prüfe Mail Security für ${domain} ...`, "idle");
  setLoading();

  try {
    const [mxData, txtData, dmarcData] = await Promise.all([
      lookup(domain, "MX"),
      lookup(domain, "TXT"),
      lookup(`_dmarc.${domain}`, "TXT"),
    ]);

    renderResult(domain, mxData, txtData, dmarcData);
  } catch (error) {
    setStatus(error.message || "DNS-Abfrage fehlgeschlagen.", "FAIL");
    mxRecords.innerHTML = '<li class="empty">Keine Daten empfangen.</li>';
    spfRecord.textContent = "Keine Daten empfangen.";
    dmarcRecord.textContent = "Keine Daten empfangen.";
    rawOutput.textContent = error.message;
  } finally {
    checkButton.disabled = false;
  }
}

form.addEventListener("submit", handleLookup);

const payload = Kernel.router.getPayload();
if (payload?.domain) {
  domainInput.value = payload.domain;
  Kernel.router.clearPayload();
  form.requestSubmit();
} else {
  const previous = Kernel.state.get(stateKey);
  if (previous?.domain) {
    domainInput.value = previous.domain;
  }
}
