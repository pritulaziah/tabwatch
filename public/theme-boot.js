/**
 * Applies the stored theme before the first paint.
 *
 * The script is not part of the bundle: it must run synchronously, before
 * the stylesheet, so the page never paints in the wrong theme. The module
 * bundle and chrome.storage are both too late for that. The value comes
 * from the mirror that src/ui/theme.ts writes on every change: keep the
 * key, the default, and the rules in sync with that module.
 */
(function () {
  /** Mirror of the theme setting: null when it is absent or unreadable. */
  function readMirror() {
    try {
      return window.localStorage.getItem('tabwatch.theme');
    } catch {
      return null;
    }
  }

  const stored = readMirror();
  const theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'system' ? prefersDark : theme === 'dark';

  document.documentElement.classList.toggle('dark', dark);
})();
