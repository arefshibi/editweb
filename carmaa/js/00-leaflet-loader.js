/* Leaflet is intentionally loaded only when a map becomes relevant. */
(function () {
  let pending = null;
  const scriptUrls = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  ];
  const styleUrls = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  ];

  function loadScriptAt(index) {
    if (window.L && typeof window.L.map === 'function') return Promise.resolve(true);
    if (index >= scriptUrls.length) return Promise.resolve(false);
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = scriptUrls[index];
      script.async = true;
      script.dataset.carmaLeaflet = 'script';
      script.onload = () => resolve(!!(window.L && typeof window.L.map === 'function'));
      script.onerror = () => {
        script.remove();
        loadScriptAt(index + 1).then(resolve, () => resolve(false));
      };
      document.head.appendChild(script);
    });
  }

  function loadStyleAt(index) {
    if (document.querySelector('link[data-carma-leaflet="style"][data-loaded="1"]')) return Promise.resolve(true);
    if (index >= styleUrls.length) return Promise.resolve(false);
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = styleUrls[index];
      link.dataset.carmaLeaflet = 'style';
      link.onload = () => { link.dataset.loaded = '1'; resolve(true); };
      link.onerror = () => {
        link.remove();
        loadStyleAt(index + 1).then(resolve, () => resolve(false));
      };
      document.head.appendChild(link);
    });
  }

  window.CARMA_LOAD_LEAFLET = function () {
    if (window.L && typeof window.L.map === 'function' && document.querySelector('link[data-carma-leaflet="style"][data-loaded="1"]')) {
      return Promise.resolve(true);
    }
    if (pending) return pending;
    pending = Promise.all([loadStyleAt(0), loadScriptAt(0)])
      .then(([styleOk, scriptOk]) => {
        const ok = styleOk && scriptOk && !!(window.L && typeof window.L.map === 'function');
        if (!ok) pending = null; // Permit a retry if the network becomes available later.
        return ok;
      })
      .catch(() => { pending = null; return false; });
    return pending;
  };
})();
