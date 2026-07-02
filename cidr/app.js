import Kernel from "../core/kernel.js";

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

function parseIPv4(value) {
  const parts = value.trim().split(".");

  if (parts.length !== 4) {
    throw new Error("IPv4-Adresse muss aus vier Oktetten bestehen.");
  }

  const octets = parts.map((part) => {
    if (!/^\d+$/.test(part)) {
      throw new Error("IPv4-Adresse darf nur Zahlen und Punkte enthalten.");
    }

    const number = Number(part);
    if (number < 0 || number > 255) {
      throw new Error("Jedes Oktett muss zwischen 0 und 255 liegen.");
    }

    return number;
  });

  return octetsToInt(octets);
}

function parsePrefix(value) {
  const prefix = Number(value);

  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("CIDR Prefix muss eine ganze Zahl zwischen 0 und 32 sein.");
  }

  return prefix;
}

function octetsToInt(octets) {
  return (
    ((octets[0] << 24) >>> 0) +
    ((octets[1] << 16) >>> 0) +
    ((octets[2] << 8) >>> 0) +
    octets[3]
  ) >>> 0;
}

function intToIp(value) {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
}

function intToBinaryIp(value) {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ]
    .map((octet) => octet.toString(2).padStart(8, "0"))
    .join(".");
}

function prefixToMask(prefix) {
  if (prefix === 0) {
    return 0;
  }

  return (0xffffffff << (32 - prefix)) >>> 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("de-DE").format(value);
}

function calculateSubnet(ipValue, prefix) {
  const mask = prefixToMask(prefix);
  const wildcard = (~mask) >>> 0;
  const network = (ipValue & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const totalAddresses = 2 ** (32 - prefix);

  let firstHost = network;
  let lastHost = broadcast;
  let usableHosts = totalAddresses;

  if (prefix <= 30) {
    firstHost = (network + 1) >>> 0;
    lastHost = (broadcast - 1) >>> 0;
    usableHosts = Math.max(totalAddresses - 2, 0);
  }

  return {
    inputIp: ipValue,
    prefix,
    mask,
    wildcard,
    network,
    broadcast,
    firstHost,
    lastHost,
    totalAddresses,
    usableHosts,
  };
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
    setStatus("Eingabe prüfen", "ERROR");
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
