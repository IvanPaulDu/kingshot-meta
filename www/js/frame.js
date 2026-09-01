/*
 * frame.js — Anclajes de composición.
 *
 * El lienzo mide siempre 320 px de ancho pero su alto sigue la proporción del
 * dispositivo, así que ninguna posición puede estar escrita a mano. Cada
 * elemento pide su sitio por nombre y este módulo lo resuelve.
 */
(function (global) {
  'use strict';

  function Frame(width, height) {
    this.width = width;
    this.height = height;
    this.midX = width / 2;
    this.midY = height / 2;
  }

  Frame.prototype = {
    /** Distancia en píxeles desde el borde superior. */
    top: function (offset) { return offset; },

    /** Distancia en píxeles desde el borde inferior. */
    bottom: function (offset) { return this.height - offset; },

    /** Fracción del alto: 0 arriba, 1 abajo. */
    band: function (fraction) { return this.height * fraction; },

    /** Distancia desde el borde izquierdo o, en negativo, desde el derecho. */
    column: function (offset) {
      return offset < 0 ? this.width + offset : offset;
    },

    /** Diagonal, útil para lo que gira sobre el centro. */
    diagonal: function () {
      return Math.ceil(Math.sqrt(this.width * this.width + this.height * this.height));
    }
  };

  global.Frame = Frame;

})(window);
