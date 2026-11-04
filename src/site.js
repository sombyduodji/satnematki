// On the start page, a place's picture plays a short clip of the game while the mouse is over it. It loads only then, and
// phones and anyone who has asked for less motion keep the still picture.
if (matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) {
  for (const figure of document.querySelectorAll(".places figure")) {
    const picture = figure.querySelector("img");
    const still = picture.src;
    const clip = still.replace(/art\/site\/(\w+)\.png$/, "art/site/clips/$1.webp");
    let over = false;
    figure.addEventListener("mouseenter", () => {
      over = true;
      const loading = new Image();
      loading.onload = () => {
        if (over) picture.src = clip;
      };
      loading.src = clip;
    });
    figure.addEventListener("mouseleave", () => {
      over = false;
      picture.src = still;
    });
  }
}
