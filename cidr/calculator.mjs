export function octetsToInt(octets) {
  return (
    ((octets[0] << 24) >>> 0) +
    ((octets[1] << 16) >>> 0) +
    ((octets[2] << 8) >>> 0) +
    octets[3]
  ) >>> 0;
}

export function intToIp(value) {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
}

export function intToBinaryIp(value) {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ]
    .map((octet) => octet.toString(2).padStart(8, "0"))
    .join(".");
}

export function parseIPv4(value) {
  const parts = String(value).trim().split(".");

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

export function parsePrefix(value) {
  const normalized = String(value).trim();

  if (normalized === "") {
    throw new Error("CIDR Prefix muss eine ganze Zahl zwischen 0 und 32 sein.");
  }

  const prefix = Number(normalized);

  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("CIDR Prefix muss eine ganze Zahl zwischen 0 und 32 sein.");
  }

  return prefix;
}

export function prefixToMask(prefix) {
  if (prefix === 0) {
    return 0;
  }

  return (0xffffffff << (32 - prefix)) >>> 0;
}

export function calculateSubnet(ipValue, prefix) {
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
