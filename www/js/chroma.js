/*
 * chroma.js — Muestrario de color del juego.
 *
 * Siete tonos elegidos para que dos cualesquiera se distingan de un vistazo:
 * el juego entero consiste en emparejar un color con otro. Cinco son tonos
 * vivos repartidos por el círculo cromático, y los otros dos son el blanco y
 * el negro, que no se confunden con nada.
 *
 * El telón de fondo usa una gama aparte, apagada y de luminosidad media, por
 * dos razones: no compite con los colores de la partida y deja legibles tanto
 * el blanco como el negro, que sobre un fondo vivo se perderían.
 */
(function (global) {
  'use strict';

  var SWATCHES = [
    { id: 'crimson', css: '#e8476b', tint: 0xe8476b },
    { id: 'amber',   css: '#f2a83c', tint: 0xf2a83c },
    { id: 'lime',    css: '#74c93e', tint: 0x74c93e },
    { id: 'white',   css: '#ffffff', tint: 0xffffff },
    { id: 'black',   css: '#000000', tint: 0x000000 },
    { id: 'indigo',  css: '#5a5fd6', tint: 0x5a5fd6 },
    { id: 'orchid',  css: '#b74fd1', tint: 0xb74fd1 }
  ];

  // Gama del telón: apagada, de luminosidad media, sin parecido con la de arriba.
  var BACKDROP = [0x5a7ea8, 0x9b6d9e, 0x79a25a, 0xb3824f, 0x56a29a];

  var INK = '#1d2027';
  var PAPER = '#ffffff';

  function brightness(index) {
    var t = SWATCHES[index].tint;
    var r = (t >> 16) & 0xff, g = (t >> 8) & 0xff, b = t & 0xff;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  /**
   * Elige un índice descartando los que se le pasen. Se construye la lista de
   * candidatos admisibles y se sortea una sola vez, en lugar de sortear a
   * ciegas y repetir hasta acertar.
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
    BACKDROP: BACKDROP,
    INK: INK,
    PAPER: PAPER,
    count: SWATCHES.length,
    tint: function (index) { return SWATCHES[index].tint; },
    css: function (index) { return SWATCHES[index].css; },
    brightness: brightness,
    pickExcluding: pickExcluding,

    /** Contorno que hace visible una muestra sobre cualquier fondo. */
    outline: function (index) { return brightness(index) > 0.55 ? INK : PAPER; },

    /**
     * Tinte del chispazo del acierto. Un destello negro no se vería, así que
     * los tonos oscuros destellan en blanco.
     */
    spark: function (index) { return brightness(index) < 0.25 ? 0xffffff : SWATCHES[index].tint; },

    /** Par inicial de columnas: dos tonos distintos. */
    openingPair: function () {
      var left = pickExcluding([]);
      return { left: left, right: pickExcluding([left]) };
    }
  };

})(window);
