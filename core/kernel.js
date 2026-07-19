import api from "./api.js";
import state from "./state.js";
import router from "./router.js";

const copyResetTimers = new WeakMap();

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    let clipboardTimeout;

    try {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => {
          clipboardTimeout = window.setTimeout(
            () => reject(new Error("Clipboard Timeout")),
            800
          );
        }),
      ]);
      return;
    } catch {
      // Ältere oder restriktive Browser können den Fallback weiter unten nutzen.
    } finally {
      window.clearTimeout(clipboardTimeout);
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Kopieren wird von diesem Browser nicht unterstützt.");
  }
}

function setCopyFeedback(button, message, state) {
  const originalLabel = button.dataset.copyLabel || button.textContent.trim();
  button.dataset.copyLabel = originalLabel;
  button.textContent = message;
  button.classList.toggle("is-copied", state === "copied");
  button.classList.toggle("is-error", state === "error");

  window.clearTimeout(copyResetTimers.get(button));
  copyResetTimers.set(button, window.setTimeout(() => {
    button.textContent = originalLabel;
    button.classList.remove("is-copied", "is-error");
  }, 4000));
}

function initCopyButtons() {
  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    if (button.dataset.copyReady === "true") {
      return;
    }

    button.dataset.copyReady = "true";
    button.addEventListener("click", async () => {
      const target = document.querySelector(button.dataset.copyTarget);
      const text = target?.textContent?.trim();

      if (!text || text === "-" || text.startsWith("Noch keine")) {
        setCopyFeedback(button, "Keine Daten", "error");
        return;
      }

      try {
        await copyText(text);
        setCopyFeedback(button, "Kopiert", "copied");
      } catch {
        setCopyFeedback(button, "Kopieren fehlgeschlagen", "error");
      }
    });
  });
}

const Kernel = {
  api,
  state,
  router,
  init() {
    initCopyButtons();
    return Kernel;
  },
};

window.RunlevelKernel = Kernel;

export default Kernel;
