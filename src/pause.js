// The pause menu: Esc in a round, or the ⏸ button in the corner on a touch screen. The game waits, clock and all, and the menu
// offers to go on, to start the level again, the main menu, and the graphics (the GPU or the basic 2D canvas, how many effects,
// the performance counter). Text or sound only, the help bubbles and the clock are only in the main menu, between rounds: they
// decide how a round is played and timed, and which best times it counts for, so they can't change halfway. Loaded after game.js.

const PAUSE_TEXT = {
  fi: {
    title: "Tauko", resume: "Jatka", restart: "Aloita alusta", graphics: "Grafiikka", effects: "Tehosteet",
    gpu: "Näytönohjain (GPU)", basic: "Perusgrafiikka", perf: "Suorituskyky",
    effectNames: ["Pois", "Valo", "Hehku", "Kaikki"], open: "Tauko",
  },
  nb: {
    title: "Pause", resume: "Fortsett", restart: "Start på nytt", graphics: "Grafikk", effects: "Effekter",
    gpu: "Skjermkort (GPU)", basic: "Enkel grafikk", perf: "Ytelse",
    effectNames: ["Av", "Lys", "Glød", "Alt"], open: "Pause",
  },
};
const pauseText = () => PAUSE_TEXT[LANG] ?? PAUSE_TEXT.fi;

let pauseWasPaused = false;
const pauseOpen = () => !!document.getElementById("pause");

// A round is going on, nothing else is open over it, and the game isn't already waiting for something.
function canPause() {
  return theme && !document.body.classList.contains("menu") && !document.getElementById("results") && !document.getElementById("book-party")
    && !document.getElementById("book-page") && !document.querySelector("dialog[open]") && !(theme.lesson && lesson?.typing) && !paused;
}

// Esc: closes the menu if it's open, opens it if it can. Says whether it did either.
function pauseKey(event) {
  if (pauseOpen()) {
    event.preventDefault();
    closePause(true);
    return true;
  }
  if (!canPause()) return false;
  event.preventDefault();
  openPause();
  return true;
}

function openPause() {
  if (pauseOpen() || !canPause()) return;
  const t = pauseText();
  pauseWasPaused = paused;
  paused = true;
  held.clear();
  me.route = [];
  me.goal = null;
  const page = document.createElement("div");
  page.id = "pause";
  page.setAttribute("role", "dialog");
  page.setAttribute("aria-label", t.title);
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `<h2>⏸ ${t.title}</h2>
    <div class="actions">
      <button class="resume">▶ ${t.resume}</button>
      <button class="restart">↻ ${t.restart}</button>
      <button class="to-menu">🏠 ${TEXT.mainMenu}</button>
    </div>
    <h3>${t.graphics}</h3>
    <div class="graphics"></div>`;
  // The graphics: which way it draws (a page reload, asked first by src/gl/panel.js), the effects on the GPU, the counter.
  const graphics = panel.querySelector(".graphics");
  const way = document.createElement("div");
  way.className = "segments";
  for (const [gpu, label] of [[true, t.gpu], [false, t.basic]]) {
    const button = document.createElement("button");
    button.textContent = label;
    button.setAttribute("aria-pressed", String(!!ctx.gpu === gpu));
    button.addEventListener("click", () => {
      if (!!ctx.gpu === gpu) return;
      document.getElementById("graphics-toggle")?.click();
    });
    way.append(button);
  }
  graphics.append(way);
  const quality = document.getElementById("gl-quality");
  if (ctx.gpu && quality) {
    const effects = document.createElement("div");
    effects.className = "segments effects";
    effects.setAttribute("aria-label", t.effects);
    effects.insertAdjacentHTML("beforeend", `<span>${t.effects}</span>`);
    t.effectNames.forEach((name, level) => {
      const button = document.createElement("button");
      button.textContent = name;
      const show = () => effects.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-pressed", String(String(i) === quality.value)));
      button.addEventListener("click", () => {
        quality.value = String(level);
        quality.dispatchEvent(new Event("change"));
        show();
      });
      effects.append(button);
      queueMicrotask(show);
    });
    graphics.append(effects);
  }
  // On a touch screen the zoom is here rather than in the corner, where the thumbs would hit it.
  const zooms = [...document.querySelectorAll("#zoom button")].filter((b) => !b.hidden);
  if (TOUCH_UI && zooms.length > 1 && !document.getElementById("zoom").hidden) {
    const zoom = document.createElement("div");
    zoom.className = "segments zoom";
    zoom.insertAdjacentHTML("beforeend", `<span>Zoom</span>`);
    for (const original of zooms) {
      const button = document.createElement("button");
      button.textContent = original.textContent;
      button.setAttribute("aria-pressed", original.getAttribute("aria-pressed"));
      button.addEventListener("click", () => {
        original.click();
        zoom.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-pressed", zooms[i].getAttribute("aria-pressed")));
      });
      zoom.append(button);
    }
    graphics.prepend(zoom);
  }
  const perf = document.getElementById("perf-toggle");
  if (perf) {
    graphics.append(menuSwitch("perf", "📊", t.perf, perf.getAttribute("aria-pressed") === "true", TEXT.on, TEXT.off, () => perf.click()));
  }
  page.append(panel);
  document.body.append(page);
  panel.querySelector(".resume").addEventListener("click", () => closePause(true));
  panel.querySelector(".restart").addEventListener("click", () => {
    closePause();
    restartRound();
  });
  panel.querySelector(".to-menu").addEventListener("click", () => showPlaces());
  page.addEventListener("click", (event) => event.target === page && closePause(true));
  panel.querySelector(".resume").focus();
}

// Closed to go on playing, the game carries on from where it was, and a word that was to be asked meanwhile is asked now.
function closePause(resume = false) {
  const page = document.getElementById("pause");
  if (!page) return;
  page.remove();
  if (!resume) return;
  paused = pauseWasPaused;
  held.clear();
  if (!paused && targets.length && promptEl.querySelector(".target.waiting")) announceAfter(rightSpeech ?? Promise.resolve());
  canvas.focus?.();
}

// On a touch screen there's no Esc: a ⏸ button in the corner, before the clock.
(function () {
  const corner = document.getElementById("corner");
  if (!corner) return;
  const button = document.createElement("button");
  button.id = "pause-open";
  button.textContent = "⏸";
  button.setAttribute("aria-label", pauseText().open);
  button.addEventListener("click", (event) => {
    event.currentTarget.blur();
    openPause();
  });
  corner.prepend(button);
})();
