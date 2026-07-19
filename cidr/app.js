import Kernel from "../core/kernel.js";
import {
  calculateSubnet,
  intToBinaryIp,
  intToIp,
  parseIPv4,
  parsePrefix,
} from "./calculator.mjs";

Kernel.init();

const form = document.querySelector("#cidr-form");
const ipInput = document.querySelector("#ip-input");
const prefixInput = document.querySelector("#prefix-input");
const statusText = document.querySelector("#status-text");
const statusBadge = document.querySelector("#status-badge");
const signalDot = document.querySelector("#signal-dot");
const quickActions = document.querySelectorAll("[data-ip]");
const stateKey = "cidr:lastCalculation";

const fields = {
  network: document.querySelector("#network-address"),
  broadcast: document.querySelector("#broadcast-address"),
  firstHost: document.querySelector("#first-host"),
  lastHost: document.querySelector("#last-host"),
  usableHosts: document.querySelector("#usable-hosts"),
  totalAddresses: document.querySelector("#total-addresses"),
  decimalMask: document.querySelector("#decimal-mask"),
  wildcardMask: document.querySelector("#wildcard-mask"),
  binaryMask: document.querySelector("#binary-mask"),
  detail: document.querySelector("#detail-output"),
};

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
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("de-DE").format(value);
}

function renderResult(result) {
  fields.network.textContent = intToIp(result.network);
  fields.broadcast.textContent = intToIp(result.broadcast);
  fields.firstHost.textContent = intToIp(result.firstHost);
  fields.lastHost.textContent = intToIp(result.lastHost);
  fields.usableHosts.textContent = formatNumber(result.usableHosts);
  fields.totalAddresses.textContent = formatNumber(result.totalAddresses);
  fields.decimalMask.textContent = intToIp(result.mask);
  fields.wildcardMask.textContent = intToIp(result.wildcard);
  fields.binaryMask.textContent = intToBinaryIp(result.mask);
  fields.detail.textContent = [
    `Eingabe: ${intToIp(result.inputIp)}/${result.prefix}`,
    `Netzwerk: ${intToIp(result.network)}/${result.prefix}`,
    `Maske: ${intToIp(result.mask)}`,
    `Wildcard: ${intToIp(result.wildcard)}`,
    `Broadcast: ${intToIp(result.broadcast)}`,
    `Hostbereich: ${intToIp(result.firstHost)} - ${intToIp(result.lastHost)}`,
    `Nutzbare Hosts: ${formatNumber(result.usableHosts)}`,
    `Adressen gesamt: ${formatNumber(result.totalAddresses)}`,
  ].join("\n");
}

function renderError(message) {
  Object.values(fields).forEach((field) => {
    field.textContent = "-";
  });
  fields.detail.textContent = message;
}

function handleCalculate(event) {
  event.preventDefault();

  try {
    const ipValue = parseIPv4(ipInput.value);
    const prefix = parsePrefix(prefixInput.value);
    const result = calculateSubnet(ipValue, prefix);

    Kernel.state.set(stateKey, {
      ip: ipInput.value.trim(),
      prefix,
    });
    renderResult(result);
    setStatus("Berechnung erfolgreich", "OK");
  } catch (error) {
    renderError(error.message);
    setStatus(error.message, "ERROR");
  }
}

quickActions.forEach((button) => {
  button.addEventListener("click", () => {
    ipInput.value = button.dataset.ip;
    prefixInput.value = button.dataset.prefix;
    form.requestSubmit();
  });
});

form.addEventListener("submit", handleCalculate);

const payload = Kernel.router.getPayload();
if (payload?.ip) {
  ipInput.value = payload.ip;
  if (payload.prefix !== undefined) {
    prefixInput.value = payload.prefix;
  }
  Kernel.router.clearPayload();
} else {
  const previous = Kernel.state.get(stateKey);
  if (previous?.ip) {
    ipInput.value = previous.ip;
  }
  if (previous?.prefix !== undefined) {
    prefixInput.value = previous.prefix;
  }
}

form.requestSubmit();
