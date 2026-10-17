/* Hosts with no /join/* rewrite send invite links here. Hand them to the invite page. */
(() => {
  const match = /^\/join\/([^/]+)\/?$/.exec(location.pathname);
  if (!match || match[1] === 'index.html') return;
  let code = match[1];
  try {
    code = decodeURIComponent(code);
  } catch {
    // keep it as it came
  }
  location.replace(`/join/?code=${encodeURIComponent(code)}`);
})();
