// Apply stored theme immediately to prevent flash of wrong theme.
// Must be loaded as a synchronous (non-deferred) <script> in <head>,
// before any CSS links, so data-theme is set on <html> before first paint.
(function () {
  var stored = localStorage.getItem('opendesk-theme');
  var theme =
    stored === 'dark' ? 'dark'
    : stored === 'light' ? 'light'
    : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  document.documentElement.setAttribute('data-theme', theme);
})();
