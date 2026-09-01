/*
 * chroma.js — Muestrario de color del juego.
 *
 * Siete tonos repartidos por el círculo cromático con la misma saturación y
 * luminosidad, para que dos cualesquiera se distingan de un vistazo: el juego
 * entero consiste en emparejar un color con otro.
 */
(function (global) {
  'use strict';

  var SWATCHES = [
    { id: 'crimson', css: '#e8476b', tint: 0xe8476b },
    { id: 'amber',   css: '#f2a83c', tint: 0xf2a83c },
    { id: 'lime',    css: '#74c93e', tint: 0x74c93e },
    { id: 'jade',    css: '#35c98a', tint: 0x35c98a },
    { id: 'azure',   css: '#33a8d1', tint: 0x33a8d1 },
    { id: 'indigo',  css: '#5a5fd6', tint: 0x5a5fd6 },
    { id: 'orchid',  css: '#b74fd1', tint: 0xb74fd1 }
  ];

  var INK = '#1d2027';
  var PAPER = '#ffffff';

  /**
   * Elige un índice de muestra descartando los que se le pasen.
   * Se construye la lista de candidatos admisibles y se sortea una sola vez,
   * en lugar de sortear a ciegas y repetir hasta acertar.
   */
  function pickExcluding(banned) {
    var pool = [];
    for (var i = 0; i < SWATCHES.length; i++) {
      if (banned.indexOf(i) === -1) { pool.push(i); }
    }
    if (!pool.length) { pool = [0]; }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  global.Chroma = {
    SWATCHES: SWATCHES,
    INK: INK,
    PAPER: PAPER,
    count: SWATCHES.length,
    tint: function (index) { return SWATCHES[index].tint; },
    css: function (index) { return SWATCHES[index].css; },
    pickExcluding: pickExcluding,

    /** Par inicial de columnas: dos tonos distintos. */
    openingPair: function () {
      var left = pickExcluding([]);
      return { left: left, right: pickExcluding([left]) };
    }
  };

})(window);
