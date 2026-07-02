import state from "./state.js";

const payloadKey = "router:payload";

function toolUrl(tool) {
  const safeTool = String(tool || "").trim().toLowerCase();

  if (!/^[a-z0-9-]+$/.test(safeTool)) {
    throw new Error("Ungültiger Tool-Name.");
  }

  return new URL(`../${safeTool}/index.html`, import.meta.url).toString();
}

export function open(tool, payload = null) {
  if (payload !== null && payload !== undefined) {
    state.set(payloadKey, {
      tool,
      payload,
      createdAt: Date.now(),
    });
  } else {
    clearPayload();
  }

  window.location.href = toolUrl(tool);
}

export function getPayload() {
  const entry = state.get(payloadKey);
  return entry?.payload ?? null;
}

export function clearPayload() {
  state.remove(payloadKey);
}

export default {
  open,
  getPayload,
  clearPayload,
};
