import Kernel from "../core/kernel.js";
import { cleanDomain, escapeHtml, isValidDomain } from "../core/domain.js";

Kernel.init();

const form = document.querySelector("#dns-form");
const domainInput = document.querySelector("#domain-input");
const recordType = document.querySelector("#record-type");
const statusText = document.querySelector("#status-text");
const rcodeBadge = document.querySelector("#rcode-badge");
const answersBody = document.querySelector("#answers");
const rawOutput = document.querySelector("#raw-output");
const quickActions = document.querySelectorAll("[data-domain]");
const stateKey = "dns:lastLookup";

const typeCodes = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  CAA: 257,
};

const typeNames = Object.fromEntries(
  Object.entries(typeCodes).map(([name, code]) => [code, name])
);

const rcodes = {
  0: "NOERROR",
  1: "FORMERR",
  2: "SERVFAIL",
  3: "NXDOMAIN",
  4: "NOTIMP",
  5: "REFUSED",
};

function setStatus(message, state = "idle") {
  statusText.textContent = message;
  rcodeBadge.textContent = state;
  rcodeBadge.className = "badge";

  if (state === "NOERROR") {
    rcodeBadge.classList.add("ok");
  } else if (state === "NXDOMAIN" || state === "SERVFAIL" || state === "REFUSED") {
    rcodeBadge.classList.add("bad");
  } else if (state !== "idle" && state !== "lade") {
    rcodeBadge.classList.add("warn");
  }
}

function setEmpty(message) {
  answersBody.innerHTML = `<tr><td colspan="4" class="empty">${message}</td></tr>`;
}

function normalizeRecordData(record) {
  const type = typeNames[record.type] || `TYPE${record.type}`;
  const data = record.data || "";

  if (type === "TXT") {
    return data.replace(/^"|"$/g, "");
  }

  if (type === "MX") {
    return data;
  }

  return data;
}

function renderAnswers(records) {
  if (!records || records.length === 0) {
    setEmpty("Keine Records für diese Abfrage gefunden.");
    return;
  }

  answersBody.innerHTML = records
    .map((record) => {
      const type = typeNames[record.type] || `TYPE${record.type}`;
      return `
        <tr>
          <td>${escapeHtml(record.name || "-")}</td>
          <td>${escapeHtml(type)}</td>
          <td>${escapeHtml(record.TTL ?? "-")}</td>
          <td class="record-value">${escapeHtml(normalizeRecordData(record))}</td>
        </tr>
      `;
    })
    .join("");
}

async function lookup(domain, type) {
  const url = new URL("https://cloudflare-dns.com/dns-query");
  url.searchParams.set("name", domain);
  url.searchParams.set("type", type);

  return Kernel.api.fetchJSON(url, {
    headers: {
      accept: "application/dns-json",
    },
  });
}

async function handleLookup(event) {
  event.preventDefault();

  const domain = cleanDomain(domainInput.value);
  const type = recordType.value;

  domainInput.value = domain;
  Kernel.state.set(stateKey, { domain, type });

  if (!isValidDomain(domain)) {
    setStatus("Bitte eine gültige Domain eingeben.", "warn");
    setEmpty("Keine Abfrage gestartet.");
    rawOutput.textContent = "Ungültige Domain.";
    return;
  }

  setStatus(`Frage ${type} für ${domain} ab ...`, "lade");
  setEmpty("Abfrage läuft ...");
  rawOutput.textContent = "warte auf resolver ...";

  try {
    const data = await lookup(domain, type);
    const rcode = rcodes[data.Status] || `RCODE ${data.Status}`;
    const records = data.Answer || [];

    setStatus(`${records.length} Antwort(en) für ${domain}.`, rcode);
    renderAnswers(records);
    rawOutput.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    setStatus("DNS-Abfrage fehlgeschlagen.", "SERVFAIL");
    setEmpty("Keine Daten empfangen.");
    rawOutput.textContent = error.message;
  }
}

quickActions.forEach((button) => {
  button.addEventListener("click", () => {
    domainInput.value = button.dataset.domain;
    recordType.value = button.dataset.type;
    form.requestSubmit();
  });
});

form.addEventListener("submit", handleLookup);

const payload = Kernel.router.getPayload();
if (payload?.domain) {
  domainInput.value = payload.domain;
  if (payload.type) {
    recordType.value = payload.type;
  }
  Kernel.router.clearPayload();
  form.requestSubmit();
} else {
  const previous = Kernel.state.get(stateKey);
  if (previous?.domain) {
    domainInput.value = previous.domain;
  }
  if (previous?.type) {
    recordType.value = previous.type;
  }
}
