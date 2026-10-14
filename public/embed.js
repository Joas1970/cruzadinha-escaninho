/* Ajuste de altura para a cruzadinha incorporada, sem acesso às respostas. */
(() => {
  if (window.__escaninhoCrosswordEmbed) return;
  window.__escaninhoCrosswordEmbed = true;
  window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "escaninho:crossword:resize") return;
    const height = event.data.height;
    if (typeof height !== "number" || !Number.isFinite(height) || height < 100 || height > 16000)
      return;
    for (const frame of document.querySelectorAll("iframe[data-cruzadinha-embed]")) {
      if (frame.contentWindow !== event.source) continue;
      try {
        if (new URL(frame.src).origin !== event.origin) continue;
        frame.style.height = `${Math.ceil(height) + 4}px`;
      } catch {
        /* Ignora endereços inválidos. */
      }
    }
  });
})();
