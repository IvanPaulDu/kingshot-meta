/*
 * shell.js — Acoplamiento al teléfono.
 *
 * No toca el juego: solo desactiva los gestos del navegador, avisa cuando el
 * teléfono está tumbado, desbloquea el audio y encamina el botón físico atrás.
 */
(function (global) {
  'use strict';

  ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu'].forEach(function (name) {
    document.addEventListener(name, function (ev) { ev.preventDefault(); }, { passive: false });
  });

  document.addEventListener('touchmove', function (ev) {
    if (ev.touches.length > 1) { ev.preventDefault(); }
  }, { passive: false });

  var lastTouchAt = 0;
  document.addEventListener('touchend', function (ev) {
    var now = Date.now();
    if (now - lastTouchAt < 320) { ev.preventDefault(); }   // doble toque = zoom
    lastTouchAt = now;
  }, { passive: false });

  function markOrientation() {
    document.body.classList.toggle('sideways', global.innerWidth > global.innerHeight);
  }

  var pending = null;
  function onViewportChange() {
    markOrientation();
    clearTimeout(pending);
    pending = setTimeout(function () {
      if (global.Vaiven && global.Vaiven.refit) { global.Vaiven.refit(); }
    }, 250);
  }

  global.addEventListener('resize', onViewportChange);
  global.addEventListener('orientationchange', function () { setTimeout(onViewportChange, 120); });
  if (global.visualViewport) {
    global.visualViewport.addEventListener('resize', onViewportChange);
  }
  markOrientation();
  setTimeout(function () {
    if (global.Vaiven && global.Vaiven.refit) { global.Vaiven.refit(); }
  }, 400);

  function audioContext() {
    var game = global.Vaiven && global.Vaiven.game;
    return game && game.sound ? game.sound.context : null;
  }

  ['touchend', 'pointerup', 'mousedown', 'keydown'].forEach(function (name) {
    global.addEventListener(name, function () {
      var ctx = audioContext();
      if (ctx && ctx.state === 'suspended') { ctx.resume(); }
    }, { passive: true });
  });

  document.addEventListener('visibilitychange', function () {
    var ctx = audioContext();
    if (!ctx) { return; }
    if (document.hidden) {
      if (ctx.state === 'running') { ctx.suspend(); }
    } else if (ctx.state === 'suspended') {
      ctx.resume();
    }
  });

  document.addEventListener('deviceready', function () {
    var plugins = global.Capacitor && global.Capacitor.Plugins;
    if (plugins && plugins.App) {
      plugins.App.addListener('backButton', function () { plugins.App.exitApp(); });
    }
  });

})(window);
