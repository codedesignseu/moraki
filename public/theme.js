/* Light and dark switch. The saved choice is read before paint by the inline script in <head>. */
(() => {
  const KEY = 'moraki-theme';
  const root = document.documentElement;
  const LABELS = {
    en: { theme: 'Theme', auto: 'Auto', light: 'Light', dark: 'Dark' },
    el: { theme: 'Θέμα', auto: 'Αυτόματο', light: 'Φωτεινό', dark: 'Σκοτεινό' },
  };
  const ORDER = ['auto', 'light', 'dark'];
  let current = root.getAttribute('data-theme') || 'auto';

  const save = (theme) => {
    try {
      if (theme === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      // Private browsing or blocked storage: the choice lasts for this page only.
    }
  };

  const themeColor = (theme) => {
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      const media = meta.getAttribute('media') || '';
      const dark = theme === 'dark' || (theme === 'auto' && media.includes('dark'));
      meta.setAttribute('content', dark ? '#171411' : '#F3F2EE');
    });
  };

  const render = () => {
    const l = LABELS[(root.getAttribute('lang') || 'en').slice(0, 2)] || LABELS.en;
    document.querySelectorAll('.theme-pill').forEach((group) => {
      group.setAttribute('aria-label', l.theme);
      group.querySelectorAll('[data-theme-set]').forEach((button) => {
        const key = button.getAttribute('data-theme-set');
        button.setAttribute('aria-pressed', key === current ? 'true' : 'false');
        button.setAttribute('title', l[key]);
        button.querySelector('.vh').textContent = l[key];
      });
    });
    document.querySelectorAll('.theme-cycle').forEach((button) => {
      button.setAttribute('data-state', current);
      button.setAttribute('aria-label', `${l.theme}: ${l[current]}`);
    });
  };

  const apply = (theme) => {
    current = theme;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    themeColor(theme);
    render();
  };

  const choose = (theme) => {
    apply(theme);
    save(theme);
  };

  document.querySelectorAll('.theme-pill, .theme-cycle').forEach((el) => {
    el.hidden = false;
  });
  document.querySelectorAll('[data-theme-set]').forEach((button) => {
    button.addEventListener('click', () => choose(button.getAttribute('data-theme-set')));
  });
  document.querySelectorAll('.theme-cycle').forEach((button) => {
    button.addEventListener('click', () =>
      choose(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]),
    );
  });
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) apply(e.newValue === 'light' || e.newValue === 'dark' ? e.newValue : 'auto');
  });
  document.addEventListener('moraki:lang', render);
  render();
})();
