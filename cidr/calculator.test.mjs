import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateSubnet,
  intToIp,
  parseIPv4,
  parsePrefix,
} from "./calculator.mjs";

function calculate(ip, prefix) {
  return calculateSubnet(parseIPv4(ip), parsePrefix(prefix));
}

function addresses(result) {
  return {
    network: intToIp(result.network),
    broadcast: intToIp(result.broadcast),
    firstHost: intToIp(result.firstHost),
    lastHost: intToIp(result.lastHost),
    totalAddresses: result.totalAddresses,
    usableHosts: result.usableHosts,
    mask: intToIp(result.mask),
    wildcard: intToIp(result.wildcard),
  };
}

test("/0 umfasst den gesamten IPv4-Adressraum", () => {
  assert.deepEqual(addresses(calculate("203.0.113.7", 0)), {
    network: "0.0.0.0",
    broadcast: "255.255.255.255",
    firstHost: "0.0.0.1",
    lastHost: "255.255.255.254",
    totalAddresses: 4294967296,
    usableHosts: 4294967294,
    mask: "0.0.0.0",
    wildcard: "255.255.255.255",
  });
});

test("/30 reserviert Netzwerk- und Broadcast-Adresse", () => {
  assert.deepEqual(addresses(calculate("192.0.2.6", 30)), {
    network: "192.0.2.4",
    broadcast: "192.0.2.7",
    firstHost: "192.0.2.5",
    lastHost: "192.0.2.6",
    totalAddresses: 4,
    usableHosts: 2,
    mask: "255.255.255.252",
    wildcard: "0.0.0.3",
  });
});

test("/31 behandelt beide Adressen als nutzbar", () => {
  assert.deepEqual(addresses(calculate("192.0.2.6", 31)), {
    network: "192.0.2.6",
    broadcast: "192.0.2.7",
    firstHost: "192.0.2.6",
    lastHost: "192.0.2.7",
    totalAddresses: 2,
    usableHosts: 2,
    mask: "255.255.255.254",
    wildcard: "0.0.0.1",
  });
});

test("/32 beschreibt genau eine Host-Adresse", () => {
  assert.deepEqual(addresses(calculate("192.0.2.6", 32)), {
    network: "192.0.2.6",
    broadcast: "192.0.2.6",
    firstHost: "192.0.2.6",
    lastHost: "192.0.2.6",
    totalAddresses: 1,
    usableHosts: 1,
    mask: "255.255.255.255",
    wildcard: "0.0.0.0",
  });
});

test("ungültige IPv4-Adressen werden abgelehnt", () => {
  for (const value of ["192.168.1", "192.168.1.256", "192.168.x.1", ""]) {
    assert.throws(() => parseIPv4(value), Error, value);
  }
});

test("ungültige Prefixe werden abgelehnt", () => {
  for (const value of ["", " ", -1, 33, 24.5, "abc"]) {
    assert.throws(() => parsePrefix(value), Error, String(value));
  }
});
