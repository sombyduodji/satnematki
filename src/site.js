// The flags: the same choice as in the game, kept in the browser.
(function () {
  const titles = { fi: document.title, nb: "Sátnemátki: et nordsamisk ordspill for barn" };
  const picture = document.querySelector(".hero-picture"), alts = { fi: picture.alt, nb: picture.dataset.altNb };
  const sources = { fi: picture.getAttribute("src"), nb: picture.dataset.srcNb };
  const show = (lang) => {
    document.documentElement.lang = document.documentElement.dataset.lang = lang;
    document.title = titles[lang];
    picture.alt = alts[lang];
    picture.src = sources[lang] ?? sources.fi;
    document.querySelectorAll("[data-set-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setLang === lang)));
  };
  document.querySelectorAll("[data-set-lang]").forEach((b) => b.addEventListener("click", () => {
    try { localStorage.setItem("mahtte.lang", b.dataset.setLang); } catch { /* this visit only */ }
    show(b.dataset.setLang);
  }));
  show(document.documentElement.dataset.lang);
})();
