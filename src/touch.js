// Touch controls like a game's, on a touch screen (or with ?touch on the address, to try them with a mouse): a joystick that
// appears where the left thumb lands, and round buttons for the right thumb, the big one showing what's in reach. Touching
// the picture itself does nothing, as tapping and swiping there made odd moves. The game lies sideways on a phone, and asks
// for that when held upright. The keys and the mouse work as before. Loaded after game.js and pause.js.
(() => {
  if (!TOUCH_UI) return;
  document.body.classList.add("touch-ui");
  const T = LANG === "nb"
    ? { turn: "Snu telefonen", use: "Ta", jump: "Hopp", crouch: "Huk", full: "Fullskjerm" }
    : { turn: "Käännä puhelin vaakatasoon", use: "Ota", jump: "Hyppy", crouch: "Kyykky", full: "Koko näyttö" };

  // The help speaks of the controls on the screen, not of keys a phone hasn't got.
  const touchHelp = LANG === "nb" ? {
    start: "Styr med spaken til venstre, skyv den helt ut for å løpe. Ta-knappen tar det som er nær, og viser hva det er. Hopp hopper, og pila huker deg ned.",
    startClassroom: "Styr med spaken til venstre. Gå bort til en stol og trykk Ta, så setter du deg og ser på tallet.",
    move: "Styr med spaken til venstre: den kommer der tommelen din treffer.",
    run: "Løp: skyv spaken helt ut. Når du løper, kan du ikke ta noe, og hvis du treffer noe, faller du eller sklir på magen!",
    crouch: "Ta-knappen tar eller ser på det som er nær. Pila huker deg ned, så du går sakte; trykk igjen for å reise deg.",
    crouchClassroom: "Ta-knappen ved en stol: sett deg. Pila huker deg ned.",
  } : {
    start: "Liiku vasemman reunan tatilla, ja työnnä se reunaan asti, niin juokset. Ota-painike ottaa sen, mikä on lähellä, ja näyttää, mikä se on. Hyppy hyppää, ja nuoli kyykistää.",
    startClassroom: "Liiku vasemman reunan tatilla. Mene tuolin luo ja paina Ota, niin istut ja katsot numeron.",
    move: "Liiku vasemman reunan tatilla: se tulee siihen, mihin peukalosi koskee.",
    run: "Juokse: työnnä tatti reunaan asti. Juostessa et voi ottaa mitään, ja jos osut johonkin, kaadut tai liu'ut mahallasi!",
    crouch: "Ota-painike ottaa tai katsoo sen, mikä on lähellä. Nuoli kyykistää, ja kyykyssä kävelet hitaasti; paina uudelleen, niin nouset.",
    crouchClassroom: "Ota-painike tuolin luona: istu. Nuoli kyykistää.",
  };
  TEXT.start = touchHelp.start;
  TEXT.startClassroom = touchHelp.startClassroom;
  Object.assign(TEXT.guide, { move: touchHelp.move, run: touchHelp.run, crouch: touchHelp.crouch, crouchClassroom: touchHelp.crouchClassroom });
  // And each place's own first line, where it names E or C.
  const keysToButtons = LANG === "nb"
    ? [[/trykk E\b/g, "trykk Ta"], [/med E-tasten/g, "med Ta-knappen"], [/med E\b/g, "med Ta"], [/og E tar/g, "og Ta tar"], [/ved å holde C nede/g, "med pila (huk)"], [/ På mobilen trykker du Sett deg eller på pulten\./g, ""]]
    : [[/paina E\b/g, "paina Ota"], [/E-näppäimellä/g, "Ota-painikkeella"], [/E:llä/g, "Ota-painikkeella"], [/ja E ottaa/g, "ja Ota ottaa"], [/pitämällä C pohjassa/g, "nuolinapilla"], [/ Puhelimessa paina Istu tai napauta pulpettia\./g, ""]];
  for (const [place, line] of Object.entries(TEXT.guide.goal)) TEXT.guide.goal[place] = keysToButtons.reduce((text, [from, to]) => text.replace(from, to), line);
  for (const key of ["guide", "guideAudio", "guideWords"]) {
    LESSON_TEXT[key] = LESSON_TEXT[key].replace("painamalla E tai Viittaa-painiketta", "Viittaa-painikkeella").replace("ved å trykke E eller på Rekk opp hånda", "med Rekk opp hånda-knappen");
  }
  for (const place of Object.keys(TEXT.guide.jump)) TEXT.guide.jump[place] = TEXT.guide.jump[place].replace(/^Hyppää: välilyönti\./, "Hyppää: Hyppy-painike.").replace(/^Hopp: mellomrom\./, "Hopp: Hopp-knappen.");

  // The controls as pictures in the window of instructions, short enough to fit a phone lying sideways.
  const GUIDE = LANG === "nb" ? {
    stick: ["🕹️", "Gå med spaken", "Helt ut: løp"], use: ["✋", "Ta", "Tar det som er nær"], jump: ["⤒", "Hopp", "Ikke rett på trær!"],
    crouch: ["⬇", "Huk", "Snik deg bort til sovende dyr"], sit: ["⬇", "Sett deg", "ved en stol"], raise: ["✋", LESSON_TEXT.raise, "når du kan tallet"], pause: ["⏸", "Pause", "eller tilbake-knappen"],
    zoom: ["🔍", "Zoom", "i pausemenyen ⏸, blir husket"],
  } : {
    stick: ["🕹️", "Liiku tatilla", "Reunaan asti: juokse"], use: ["✋", "Ota", "Ottaa sen, mikä on lähellä"], jump: ["⤒", "Hyppy", "Älä hyppää päin puuta!"],
    crouch: ["⬇", "Kyykky", "Hiivi nukkuvien eläinten luo"], sit: ["⬇", "Istu", "tuolin luona"], raise: ["✋", LESSON_TEXT.raise, "kun tiedät luvun"], pause: ["⏸", "Tauko", "tai takaisin-painike"],
    zoom: ["🔍", "Zoomaus", "taukovalikosta ⏸, jää muistiin"],
  };
  window.touchGuide = () => {
    const keys = theme?.lesson ? ["raise", "pause"] : theme?.desks ? ["stick", "use", "sit", "pause", "zoom"] : ["stick", "use", "jump", "crouch", "pause", "zoom"];
    const grid = document.createElement("div");
    grid.className = "touch-guide";
    for (const key of keys) {
      const [icon, name, what] = GUIDE[key];
      grid.insertAdjacentHTML("beforeend", `<div><span class="icon" aria-hidden="true">${icon}</span><b>${name}</b><small>${what}</small></div>`);
    }
    return grid;
  };

  // Fullscreen, as a browser shows its bars otherwise. Browsers allow it only from a tap, so it's asked for with the first touch
  // in a round, and the ⛶ button in the corner does it again after leaving it. Lying sideways is held as well where that's allowed.
  const page = document.documentElement;
  const canFull = !!(page.requestFullscreen || page.webkitRequestFullscreen);
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const goFull = () => {
    if (!canFull || isFull()) return;
    const asked = page.requestFullscreen ? page.requestFullscreen({ navigationUI: "hide" }) : page.webkitRequestFullscreen();
    Promise.resolve(asked).then(() => screen.orientation?.lock?.("landscape").catch(() => {})).catch(() => {});
  };
  // A button goes fullscreen with its click, not as the finger comes down: the page grows as the bars go, the window moves
  // down, and the finger would lift beside the button, so the guide's OK took two taps (phone test, 2026-11-13).
  let touchedButton = false;
  let leavingOnPurpose = false;
  const inRound = () => theme && !document.body.classList.contains("menu");
  const fullInRound = () => {
    goFull();
    if (isFull()) screen.orientation?.lock?.("landscape").catch(() => {}); // held sideways again, back in a round
  };
  document.addEventListener("pointerdown", (event) => {
    touchedButton = false;
    if (event.pointerType === "mouse" || !inRound()) return;
    if (event.target.closest?.("button, a, input, select")) touchedButton = true;
    else fullInRound();
  }, true);
  document.addEventListener("click", () => {
    if (!touchedButton) return;
    touchedButton = false;
    if (inRound()) fullInRound();
  }, true);
  // The menus are ordinary pages to read and scroll: there the phone's own bars come back and it may turn freely, so fullscreen
  // and the sideways lock are let go as soon as one opens. The next round asks for them again with its first touch.
  new MutationObserver(() => {
    if (!document.body.classList.contains("menu")) return;
    screen.orientation?.unlock?.();
    if (isFull()) Promise.resolve((document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document)).catch(() => {});
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  if (canFull) {
    const full = document.createElement("button");
    full.id = "fullscreen";
    full.textContent = "⛶";
    full.setAttribute("aria-label", T.full);
    full.addEventListener("click", (event) => {
      event.currentTarget.blur();
      if (isFull()) { leavingOnPurpose = true; (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document); }
      else goFull();
    });
    document.getElementById("corner")?.prepend(full);
    const showFull = () => full.classList.toggle("on", isFull());
    // In fullscreen the phone's Back key only takes the page out of fullscreen, and the game never hears it: so leaving
    // fullscreen in a round, other than with the ⛶ button, opens the pause menu, as Back does otherwise (phone test, 2026-11-13).
    const fullChanged = () => {
      showFull(); fittedTo = "";
      if (!isFull() && !leavingOnPurpose && inRound() && !pauseOpen()) openPause();
      if (!isFull()) leavingOnPurpose = false;
    };
    document.addEventListener("fullscreenchange", fullChanged);
    document.addEventListener("webkitfullscreenchange", fullChanged);
  }

  // Held upright, the game asks to be turned: there's no room for the controls and the picture side by side.
  const turn = document.createElement("div");
  turn.id = "turn-phone";
  turn.innerHTML = `<div><span aria-hidden="true">📱</span>${T.turn}</div>`;
  document.body.append(turn);

  // The picture walks nowhere when touched: the canvas's own tap-to-walk is for the mouse.
  window.addEventListener("pointerdown", (event) => {
    if (event.target === canvas && event.pointerType !== "mouse") event.stopImmediatePropagation();
  }, true);
  window.addEventListener("contextmenu", (event) => {
    if (!document.body.classList.contains("menu")) event.preventDefault();
  });

  // The phone's back button opens the pause menu in a round, as in a game, rather than leaving the page: a step of history is
  // kept while playing, and going back over it opens the menu (or closes it, if it's open) and puts the step back.
  let backStep = false;
  const keepBackStep = () => {
    if (backStep || !theme || document.body.classList.contains("menu")) return;
    history.pushState({ satneRound: true }, "");
    backStep = true;
  };
  window.addEventListener("popstate", () => {
    if (!backStep) return;
    backStep = false;
    if (!theme || document.body.classList.contains("menu")) return;
    if (pauseOpen()) closePause(true);
    else openPause();
    keepBackStep();
  });
  setInterval(keepBackStep, 500);

  const controls = document.createElement("div");
  controls.id = "touch-controls";
  controls.innerHTML = `<div id="stick-zone"><div id="stick"><div class="knob"></div></div></div>
    <div id="touch-buttons">
      <button id="t-crouch" aria-label="${T.crouch}" aria-pressed="false"><span aria-hidden="true">⬇</span></button>
      <button id="t-jump" aria-label="${T.jump}"><div><span aria-hidden="true">⤒</span>${T.jump}</div></button>
      <button id="t-use" aria-label="${T.use}"><div class="what"></div></button>
    </div>`;
  document.getElementById("view").append(controls);

  // The joystick: its middle is where the thumb lands. Eight ways, as the keys go; pushed to the edge, running.
  const zone = controls.querySelector("#stick-zone"), stick = controls.querySelector("#stick"), knob = stick.querySelector(".knob");
  // A wide reach, so that walking has room before running starts: running only right at the edge, pushed a moment there.
  const RADIUS = 70, DEAD = 0.2, RUN_AT = 0.95, RUN_AFTER_MS = 150;
  let edgeSince = null;
  const WAYS = { 0: ["right"], 1: ["right", "down"], 2: ["down"], 3: ["down", "left"], 4: ["left"], "-4": ["left"], "-3": ["left", "up"], "-2": ["up"], "-1": ["up", "right"] };
  let stickId = null, origin = null;
  const rest = () => {
    stick.style.left = "110px";
    stick.style.top = `${zone.clientHeight - 110}px`;
  };
  let lastDx = 0, lastDy = 0;
  const steer = (dx, dy) => {
    lastDx = dx;
    lastDy = dy;
    const push = Math.min(1, Math.hypot(dx, dy) / RADIUS);
    for (const way of ["up", "down", "left", "right"]) held.delete(way);
    runKey = false;
    stick.classList.remove("running");
    if (push < DEAD) return;
    const ways = WAYS[Math.round(Math.atan2(dy, dx) / (Math.PI / 4))];
    for (const way of ways) held.add(way);
    tapped = ways[0];
    if (push >= RUN_AT) {
      edgeSince ??= performance.now();
      if (performance.now() - edgeSince >= RUN_AFTER_MS) {
        runKey = true;
        stick.classList.add("running");
      } else setTimeout(() => stickId !== null && edgeSince !== null && steer(lastDx, lastDy), RUN_AFTER_MS);
    } else edgeSince = null;
  };
  zone.addEventListener("pointerdown", (event) => {
    if (stickId !== null || paused) return;
    event.preventDefault();
    stickId = event.pointerId;
    zone.setPointerCapture(event.pointerId);
    const box = zone.getBoundingClientRect();
    origin = { x: event.clientX, y: event.clientY };
    stick.style.left = `${event.clientX - box.left}px`;
    stick.style.top = `${event.clientY - box.top}px`;
    stick.classList.add("active");
  });
  zone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== stickId) return;
    let dx = event.clientX - origin.x, dy = event.clientY - origin.y;
    const far = Math.hypot(dx, dy);
    if (far > RADIUS) {
      dx = (dx / far) * RADIUS;
      dy = (dy / far) * RADIUS;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    steer(dx, dy);
  });
  const letGo = (event) => {
    if (event.pointerId !== stickId) return;
    stickId = null;
    edgeSince = null;
    steer(0, 0);
    knob.style.transform = "";
    stick.classList.remove("active");
    rest();
  };
  zone.addEventListener("pointerup", letGo);
  zone.addEventListener("pointercancel", letGo);
  new ResizeObserver(() => stickId === null && rest()).observe(zone);

  // The buttons do what the keys do. Crouching is a switch here, as the right thumb has other buttons to press: tap to crouch
  // (and sneak about), tap again to stand. Jumping while crouched stands up, as a crouched character can't jump.
  const press = (id, action) => {
    const button = controls.querySelector(id);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.classList.add("down");
      action();
    });
    for (const type of ["pointerup", "pointercancel", "pointerleave"]) button.addEventListener(type, () => button.classList.remove("down"));
  };
  press("#t-use", () => {
    useKey(false);
    navigator.vibrate?.(15);
  });
  press("#t-jump", () => {
    if (crouching) crouching = false;
    else jump();
  });
  press("#t-crouch", () => {
    if (crouching) crouching = false;
    else sitOrCrouch(false);
  });

  // The big button shows what's in reach, and glows; seated at a desk only it is there, for raising the hand.
  const use = controls.querySelector("#t-use"), what = use.querySelector(".what"), crouch = controls.querySelector("#t-crouch");
  let shownFor;
  const showUse = () => {
    document.body.classList.toggle("seated", !!document.getElementById("pad")?.classList.contains("seated"));
    crouch.classList.toggle("on", crouching);
    crouch.setAttribute("aria-pressed", String(crouching));
    const thing = paused || theme?.lesson ? null : thingInReach();
    const key = thing ? `${thing.word.sprite}/${thing.word.colour ?? ""}/${thing.word.number ?? ""}` : "";
    if (key === shownFor && use.dataset.lesson === String(!!theme?.lesson)) return;
    use.dataset.lesson = String(!!theme?.lesson);
    shownFor = key;
    use.classList.toggle("ready", !!thing);
    what.replaceChildren();
    if (thing) {
      try {
        const image = menuPicture(thing.word);
        const c = document.createElement("canvas");
        c.width = image.width;
        c.height = image.height;
        c.getContext("2d").drawImage(image, 0, 0);
        what.append(c);
        return;
      } catch {
        // The hand, then.
      }
    }
    what.innerHTML = `<span aria-hidden="true">✋</span>${theme?.lesson ? LESSON_TEXT.raise : T.use}`;
  };
  showUse();
  setInterval(showUse, 150);
  fittedTo = ""; // laid out again, without the pad and the links under the game
})();
