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

  // The crest is a "back to overview" button on every page. On the main page
  // that's an in-place view switch; elsewhere it navigates to index.html.
  function wireCrest() {
    const crest = document.querySelector('.crest');
    if (!crest || crest.dataset.homeWired) return;
    crest.dataset.homeWired = '1';
    crest.style.cursor = 'pointer';
    crest.setAttribute('role', 'link');
    crest.setAttribute('tabindex', '0');
    crest.title = 'Back to overview';
    const home = () => {
      if (typeof window.render === 'function' && document.getElementById('main')) {
        window.render('overview');
        window.scrollTo(0, 0);
      } else {
        location.href = 'index.html';
      }
    };
    crest.addEventListener('click', home);
    crest.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); home(); }
    });
  }

  function wire() {
    wireCrest();
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
