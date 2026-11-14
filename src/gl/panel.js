"use strict";
// The performance counter in the corner: frames a second, how long a frame takes, the GPU's effects, and a way to switch
// between the GPU and the 2D canvas. It's on at first; the switch under the game turns it off, and the browser keeps the choice.
// kauppa-gl.html goes straight into the store.
(function () {
  const params = new URLSearchParams(location.search);
  const testPage = !!window.SATNE_GL_AUTOSTART;
  const SHOWN_KEY = "mahtte.perf";
  let shown = true; // on until it's turned off, and then kept off
  try {
    const kept = localStorage.getItem(SHOWN_KEY);
    if (kept !== null) shown = kept === "1";
  } catch { /* private windows: as the page starts */ }
  const panel = document.createElement("div");
  panel.id = "gl-panel";
  panel.innerHTML = `<span id="gl-stats">…</span>
    <label>Tehosteet <select id="gl-quality"><option value="0">0 pois</option><option value="1">1 valo ja varjot</option><option value="2">2 + valokiilat ja hehku</option><option value="3">3 kaikki</option></select></label>
    <a id="gl-other"></a>`;
  // In the page just above the links under the game, so that it covers nothing, the switch least of all.
  const footer = document.querySelector("main > footer");
  if (footer) footer.before(panel);
  else document.body.append(panel);

  // The switch, among the links under the game.
  const toggle = document.createElement("button");
  toggle.id = "perf-toggle";
  toggle.className = "link";
  const show = () => {
    panel.hidden = !shown;
    toggle.textContent = LANG === "nb" ? `Ytelse: ${shown ? "på" : "av"}` : `Suorituskyky: ${shown ? "päällä" : "pois"}`;
    toggle.setAttribute("aria-pressed", String(shown));
  };
  toggle.addEventListener("click", (event) => {
    shown = !shown;
    try { localStorage.setItem(SHOWN_KEY, shown ? "1" : "0"); } catch { /* it still holds for this visit */ }
    show();
    fittedTo = ""; // src/world.js fits the game to the page again, now a line taller or shorter
    event.currentTarget.blur(); // or space, the jump key, would press it again
  });
  // After "change the character", among the links shown in a round. Help is switched only in the main menu, between rounds.
  document.getElementById("change-outfit")?.after(document.createTextNode(" · "), toggle);
  show();

  // And which way the game draws: with the GPU, or the basic 2D canvas. Some computers do better one way, some the other.
  // A page can't change that once it's drawing, so the choice is kept and the page starts again.
  const graphics = document.createElement("button");
  graphics.id = "graphics-toggle";
  graphics.className = "link";
  let wanted = false;
  try { wanted = localStorage.getItem("mahtte.gl") !== "0"; } catch { wanted = true; }
  if (testPage) wanted = !!ctx.gpu;
  graphics.textContent = LANG === "nb"
    ? `Grafikk: ${ctx.gpu ? "GPU" : wanted ? "enkel (GPU virker ikke her)" : "enkel"}`
    : `Grafiikka: ${ctx.gpu ? "GPU" : wanted ? "perus (GPU ei toimi tässä)" : "perus"}`;
  graphics.title = ctx.gpu ? "Piirrä perusgrafiikalla. Sivu alkaa alusta." : "Piirrä näytönohjaimella (GPU). Sivu alkaa alusta.";
  const RESUME_KEY = "mahtte.resume";
  const switchGraphics = () => {
    const next = !ctx.gpu;
    // The place being played, to come back to after the page starts again: a new round there, as a round can't be carried over.
    try {
      if (theme && !document.body.classList.contains("menu")) sessionStorage.setItem(RESUME_KEY, theme.id);
    } catch { /* private windows: back to the menu instead */ }
    if (testPage) {
      location.search = next ? "" : "?canvas";
      return;
    }
    try { localStorage.setItem("mahtte.gl", next ? "1" : "0"); } catch { /* the address carries it instead */ }
    const address = new URL(location.href);
    address.searchParams.set("gl", next ? "1" : "0");
    location.replace(address);
  };

  // In the middle of a round, the player is told first what switching does, and asked.
  const ask = document.createElement("dialog");
  ask.id = "graphics-ask";
  ask.innerHTML = `<h2>Vaihdetaanko grafiikka?</h2>
    <p>Peli piirtää nyt ${ctx.gpu ? "näytönohjaimella (GPU)" : "perusgrafiikalla"}. Vaihtamiseksi sivu ladataan uudelleen, ja tämä kierros alkaa alusta samassa paikassa.</p>
    <p>Kierroksen kello ja kaikki tällä kierroksella tehty nollautuvat. Hahmo, nimi, parhaat ajat ja asetukset säilyvät.</p>
    <div class="buttons"><button value="cancel" class="secondary">Peruuta</button><button value="switch" class="primary">Vaihda ja aloita alusta</button></div>`;
  document.body.append(ask);
  let wasPaused = false;
  ask.addEventListener("click", (event) => {
    const value = event.target.closest("button")?.value;
    if (value === "switch") switchGraphics();
    else if (value === "cancel") ask.close();
  });
  ask.addEventListener("close", () => {
    paused = wasPaused;
    canvas.focus?.();
  });
  graphics.addEventListener("click", (event) => {
    event.currentTarget.blur(); // or space, the jump key, would press it again
    if (document.body.classList.contains("menu") || !theme || typeof ask.showModal !== "function") {
      switchGraphics();
      return;
    }
    wasPaused = paused;
    paused = true; // the round waits while the question is open
    ask.showModal();
    ask.querySelector("button.secondary").focus();
  });
  toggle.after(document.createTextNode(" · "), graphics);
  const statsEl = document.getElementById("gl-stats"), qualityEl = document.getElementById("gl-quality"), otherEl = document.getElementById("gl-other");
  // The switch under the game changes the drawing now; on the test page this link does it too, for comparing.
  otherEl.hidden = !testPage;
  otherEl.href = ctx.gpu ? "?canvas" : "?";
  otherEl.textContent = ctx.gpu ? "2D-canvas vertailuun" : "GPU-versioon";
  const gpu = ctx.gpu ? ctx : null;
  if (gpu) {
    if (params.has("q")) gpu.post.setQuality(Number(params.get("q")));
    qualityEl.value = String(gpu.post.quality);
    qualityEl.addEventListener("change", () => { gpu.post.setQuality(Number(qualityEl.value)); qualityEl.blur(); });
  } else qualityEl.parentElement.hidden = true;

  // The store, without the menu, for whoever has a character and a name already.
  // Back to the place that was being played when the graphics were switched; on the test page, otherwise the store.
  let resume = null;
  try {
    resume = sessionStorage.getItem(RESUME_KEY);
    sessionStorage.removeItem(RESUME_KEY);
  } catch { /* nothing to come back to */ }
  const start = THEMES.find((option) => option.id === resume) ?? (testPage && !params.has("menu") ? THEMES.find((option) => option.id === "store") : null);
  if (start && chosen && loadName() !== null) {
    greeting++; // the greeting would otherwise open the menu over the place
    enterTheme(start);
  }

  // How long the game's draw() takes on the CPU, which is what held the 2D canvas back.
  const plainDraw = window.draw;
  let drawMs = 0, drawMsWorst = 0;
  window.draw = function timedDraw(now) {
    const start = performance.now();
    plainDraw(now);
    const took = performance.now() - start;
    drawMs = drawMs * 0.95 + took * 0.05;
    drawMsWorst = Math.max(drawMsWorst, took);
  };

  // Frames a second from the browser's own frame clock, the same for both ways of drawing.
  const times = [];
  let worst = 0, shownAt = 0;
  function tick(now) {
    const last = times.at(-1);
    times.push(now);
    if (last !== undefined) worst = Math.max(worst, now - last);
    while (times.length && now - times[0] > 1000) times.shift();
    if (now - shownAt > 500) {
      shownAt = now;
      const parts = [`${times.length} fps`, `pahin ${worst.toFixed(0)} ms`, `piirto ${drawMs.toFixed(1)} ms`, `${canvas.width}×${canvas.height}`];
      if (gpu) {
        parts.push(`${gpu.stats.drawsShown} piirtokutsua`, `${gpu.stats.quadsShown} kuvaa`, `atlas ${gpu.atlas.layers} sivua${gpu.atlas.copyOnGrow ? "" : " (Adreno: ei kopiota)"}`);
        if (gpu.post.gpuMs !== null) parts.push(`GPU ${gpu.post.gpuMs.toFixed(2)} ms`);
        if (qualityEl.value !== String(gpu.post.quality)) qualityEl.value = String(gpu.post.quality);
        // Only where the place has its light baked: elsewhere there's nothing for the effects to do yet.
        const lit = !!gpu.post.light;
        if (qualityEl.disabled === lit) {
          qualityEl.disabled = !lit;
          qualityEl.parentElement.style.opacity = lit ? "" : "0.45";
          qualityEl.parentElement.title = lit ? "" : "Valotehosteet ovat toistaiseksi vain ruokakaupassa, metsässä ja luokissa.";
        }
      } else parts.push("2D-canvas");
      statsEl.textContent = parts.join(" · ");
      worst = 0;
    }
    window.SATNE_STATS = { fps: times.length, drawMs, gpu: gpu ? { ...gpu.stats, gpuMs: gpu.post.gpuMs, quality: gpu.post.quality, layers: gpu.atlas.layers } : null };
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
