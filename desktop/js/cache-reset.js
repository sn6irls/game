/* Only this game's namespaced caches are removed. Other sites and apps are untouched. */
window.GAME_BUILD = '2026-09-18-release-29';
(async () => {
  if (!('caches' in window)) return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => /^sng-paint[:\-]/.test(name)).map((name) => caches.delete(name)),
    );
  } catch (_) {
    // File URLs and privacy modes may disable Cache Storage; versioned URLs still work.
  }
})();
