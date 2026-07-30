/* Light / dark / system theme toggle, shared by every page.
   No stored preference = follow the device (prefers-color-scheme). */
(function () {
  const KEY = 'vokes-theme';
  const ORDER = ['system', 'light', 'dark'];
  const ICON = { system: '◐', light: '☀', dark: '☾' };

  let mode = 'system';
  try { mode = localStorage.getItem(KEY) || 'system'; } catch (e) { /* private mode */ }
  if (!ORDER.includes(mode)) mode = 'system';

  function apply() {
    if (mode === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    const btn = document.getElementById('themeBtn');
    if (btn) {
      btn.textContent = ICON[mode];
      btn.title = `Theme: ${mode} — click to change`;
      btn.setAttribute('aria-label', `Theme: ${mode}`);
    }
  }

  // Set the attribute before first paint to avoid a flash of the wrong theme.
  apply();

  function wire() {
    const btn = document.getElementById('themeBtn');
    if (!btn) return;
    apply();
    btn.onclick = () => {
      mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
      try { localStorage.setItem(KEY, mode); } catch (e) { /* ignore */ }
      apply();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
