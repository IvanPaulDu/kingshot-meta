/*
 * mobile.js — Adaptación al entorno de teléfono (WebView de Capacitor).
 * No toca la lógica del juego: solo gestos del navegador, orientación,
 * desbloqueo del audio y el botón físico "atrás" de Android.
 */
(function () {
  'use strict';

  // --- Nada de zoom, menú contextual, selección ni scroll de rebote -----
  ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) { e.preventDefault(); }
  }, { passive: false });
  // Doble toque = zoom en algunos WebViews antiguos.
  var lastTouch = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - lastTouch < 320) { e.preventDefault(); }
    lastTouch = now;
  }, { passive: false });

  // --- Orientación y ajuste del lienzo ---------------------------------
  function syncOrientation() {
    var landscape = window.innerWidth > window.innerHeight;
    document.body.classList.toggle('landscape', landscape);
  }

  // El visor cambia de alto poco después de arrancar (Android oculta las barras
  // del sistema) y al rotar en el navegador. Se reajusta el lienzo con retardo
  // para no encadenar reinicios durante la animación de la barra.
  var reajuste = null;
  function alRedimensionar() {
    syncOrientation();
    clearTimeout(reajuste);
    reajuste = setTimeout(function () {
      if (window.ajustarLienzo) { window.ajustarLienzo(); }
    }, 250);
  }
  window.addEventListener('resize', alRedimensionar);
  window.addEventListener('orientationchange', function () {
    setTimeout(alRedimensionar, 120);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', alRedimensionar);
  }
  syncOrientation();
  // Primer ajuste tras el arranque, cuando el WebView ya tiene su tamaño final.
  setTimeout(function () { if (window.ajustarLienzo) { window.ajustarLienzo(); } }, 400);

  // --- Desbloqueo del audio al primer toque ----------------------------
  function unlockAudio() {
    if (!window.game || !window.game.sound) { return; }
    var ctx = window.game.sound.context;
    if (ctx && ctx.state === 'suspended') { ctx.resume(); }
  }
  ['touchend', 'pointerup', 'mousedown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, unlockAudio, { passive: true });
  });

  // Pausar la música al mandar la app a segundo plano.
  document.addEventListener('visibilitychange', function () {
    if (!window.game || !window.game.sound) { return; }
    var ctx = window.game.sound.context;
    if (!ctx) { return; }
    if (document.hidden) {
      if (ctx.state === 'running') { ctx.suspend(); }
    } else if (ctx.state === 'suspended') {
      ctx.resume();
    }
  });

  // --- Botón "atrás" de Android: sale de la app en el menú -------------
  document.addEventListener('deviceready', function () {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      window.Capacitor.Plugins.App.addListener('backButton', function () {
        window.Capacitor.Plugins.App.exitApp();
      });
    }
  });
})();
