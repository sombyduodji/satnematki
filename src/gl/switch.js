"use strict";
// Whether the game draws with the GPU (src/gl/) or the 2D canvas. The GPU unless the player has chosen otherwise (Grafiikka under
// the game), and the choice is kept in the browser; ?gl and ?gl=0 on the address do the same. Where the GPU can't draw, src/gl/gl2d.js
// still falls back to the 2D canvas. kauppa-gl.html sets SATNE_GL itself before this runs.
(function () {
  const params = new URLSearchParams(location.search);
  if (window.SATNE_GL !== undefined) return;
  let on = true;
  try {
    if (params.has("gl")) localStorage.setItem("mahtte.gl", params.get("gl") === "0" ? "0" : "1"); // ?gl=force also turns it on
    on = localStorage.getItem("mahtte.gl") !== "0";
  } catch {
    on = params.get("gl") !== "0";
  }
  window.SATNE_GL = on;
})();
