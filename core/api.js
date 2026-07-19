export async function fetchJSON(url, options = {}) {
  const {
    timeoutMs = 9000,
    headers,
    ...fetchOptions
  } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response;

    try {
      response = await fetch(url, {
        cache: "no-store",
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Zeitüberschreitung: Der Dienst antwortet nicht.");
      }

      throw new Error("Netzwerkfehler: Der Dienst ist nicht erreichbar.");
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Anfragelimit erreicht. Bitte später erneut versuchen.");
      }

      if (response.status >= 500) {
        throw new Error(`Dienst vorübergehend nicht verfügbar (HTTP ${response.status}).`);
      }

      throw new Error(`Anfrage vom Dienst abgelehnt (HTTP ${response.status}).`);
    }

    try {
      return await response.json();
    } catch {
      throw new Error("Ungültige Antwort: Der Dienst hat keine verwertbaren Daten geliefert.");
    }
  } finally {
    window.clearTimeout(timeout);
  }
}

export default {
  fetchJSON,
};
