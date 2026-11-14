// The page's language, as in the game (src/lang.js): the one chosen with the flags, or Norwegian for a browser set to Norwegian.
// Set before anything is shown, so the other language never flashes up.
(function () {
  let chosen = null;
  try { chosen = localStorage.getItem("mahtte.lang"); } catch { /* none kept */ }
  const nb = chosen === "nb" || (chosen !== "fi" && (navigator.languages || [navigator.language]).some((l) => /^(nb|nn|no)\b/i.test(l)));
  document.documentElement.lang = document.documentElement.dataset.lang = nb ? "nb" : "fi";
})();
