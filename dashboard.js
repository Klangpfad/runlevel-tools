import Kernel from "./core/kernel.js";

Kernel.init();

document.querySelectorAll("[data-tool]").forEach((link) => {
  link.addEventListener("click", (event) => {
    try {
      event.preventDefault();
      Kernel.router.open(link.dataset.tool);
    } catch (error) {
      console.warn("Tool-Router nicht verfügbar, nutze normalen Link.", error);
      window.location.href = link.href;
    }
  });
});
