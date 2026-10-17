/* The invite page: shows the code from /join/CODE or /join/?code=CODE. */
(() => {
  // Same rules as normaliseCode and formatCode in src/sync/invites.ts.
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const LENGTH = 8;

  const normalise = (input) =>
    String(input)
      .toUpperCase()
      .split('')
      .filter((ch) => ALPHABET.includes(ch))
      .join('')
      .slice(0, LENGTH);

  const decode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const params = new URLSearchParams(location.search);
  const match = /^\/join\/([^/]+)\/?$/.exec(location.pathname);
  const raw = params.get('code') || (match && match[1] !== 'index.html' ? decode(match[1]) : '');
  let code = normalise(raw);
  if (code.length !== LENGTH) code = '';
  const shown = code ? `${code.slice(0, 4)}-${code.slice(4)}` : '';

  const setLang = (lang) => {
    document.documentElement.setAttribute('lang', lang);
    document.querySelectorAll('[data-block]').forEach((block) => {
      block.hidden = block.getAttribute('data-block') !== lang;
    });
    document.querySelectorAll('[data-lang]').forEach((button) => {
      button.setAttribute(
        'aria-pressed',
        button.getAttribute('data-lang') === lang ? 'true' : 'false',
      );
    });
    const card = document.querySelector(`.join-card[data-block="${lang}"]`);
    if (card) document.title = card.getAttribute('data-title');
    document.dispatchEvent(new Event('moraki:lang'));
  };

  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => setLang(button.getAttribute('data-lang')));
  });
  const asked = params.get('lang');
  const browser = (navigator.language || '').toLowerCase().startsWith('el') ? 'el' : 'en';
  setLang(asked === 'el' || asked === 'en' ? asked : browser);

  document.querySelectorAll('.code').forEach((el) => {
    el.textContent = shown;
  });
  document.querySelectorAll('.has-code').forEach((el) => {
    el.hidden = !code;
  });
  document.querySelectorAll('.no-code').forEach((el) => {
    el.hidden = !!code;
  });

  const selectText = (el) => {
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      // The code is still on screen to copy by hand.
    }
  };

  document.querySelectorAll('.copy').forEach((button) => {
    button.addEventListener('click', () => {
      const box = button.parentNode;
      const status = box.querySelector('.copy-status');
      const done = (ok) => {
        if (!ok) selectText(box.querySelector('.code'));
        status.textContent = button.getAttribute(ok ? 'data-ok' : 'data-fail');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(
          () => done(true),
          () => done(false),
        );
      } else {
        done(false);
      }
    });
  });
})();
