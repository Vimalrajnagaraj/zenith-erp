(() => {
  function setup() {
    const link = document.querySelector('.zcrm-page .zcrm-tracking-url');
    if (!link || link.dataset.copyReady) return;
    link.dataset.copyReady = 'true';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'zcrm-copy-link';
    button.textContent = 'Copy link';
    button.setAttribute('aria-label', 'Copy campaign tracking link');
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(link.textContent.trim());
        button.textContent = 'Copied';
      } catch {
        button.textContent = 'Select the link to copy';
      }
    });
    link.after(button);
  }
  document.addEventListener('DOMContentLoaded', setup);
  document.addEventListener('moqui-screen-loaded', setup);
  if (document.readyState !== 'loading') setup();
})();
