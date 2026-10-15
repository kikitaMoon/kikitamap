(() => {
  const defaultLocale = 'en-US';
  const isManagedPreview =
    window.location.protocol === 'arcgis-nova:' && window.location.hostname === 'preview';
  const requestedLocale = isManagedPreview
    ? new URLSearchParams(window.location.hash.slice(1)).get('nova-app-locale')
    : null;
  const candidates = [requestedLocale, navigator.language, defaultLocale];

  for (const candidate of candidates) {
    if (!candidate?.trim()) {
      continue;
    }
    try {
      const locale = Intl.getCanonicalLocales(candidate.trim())[0];
      if (locale) {
        document.documentElement.lang = locale;
        return;
      }
    } catch {
      // Continue to the browser locale and then the fixed fallback.
    }
  }

  document.documentElement.lang = defaultLocale;
})();
