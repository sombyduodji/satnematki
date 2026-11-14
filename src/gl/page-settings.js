// This page draws with the GPU unless ?canvas is on the address, to compare with the 2D canvas.
window.SATNE_GL = !new URLSearchParams(location.search).has("canvas");
window.SATNE_GL_AUTOSTART = true;
