/*
 * backdrop.js — Telón de fondo de franjas en movimiento.
 *
 * El bloque de franjas gira y se pasea sobre el centro del lienzo, así que
 * tiene que ser lo bastante grande como para tapar las esquinas en cualquier
 * posición: la diagonal del lienzo más el diámetro del paseo. El movimiento se
 * calcula con funciones del tiempo, y el instante se guarda en el registro del
 * juego para que no dé un salto al cambiar de escena.
 */
(function (global) {
  'use strict';

  var STRIPE = 125;
  var DRIFT = 46;
  var CLOCK_SLOT = 'backdropClock';

  function Backdrop(scene, frame) {
    this.scene = scene;
    this.frame = frame;
    this.clock = scene.registry.get(CLOCK_SLOT) || 0;

    var span = frame.diagonal() + DRIFT * 2 + 20;
    var count = Math.ceil(span / STRIPE);
    if (count % 2 === 0) { count++; }          // impar: una franja centrada

    var stripes = [];
    for (var i = 0; i < count; i++) {
      var bar = scene.add.image((i - (count - 1) / 2) * STRIPE, 0, 'column');
      bar.setTint(global.Chroma.BACKDROP[i % global.Chroma.BACKDROP.length]);
      bar.setDisplaySize(STRIPE, span);
      stripes.push(bar);
    }

    this.span = span;
    this.stripeCount = count;
    this.group = scene.add.container(frame.midX, frame.midY, stripes);
    this.group.setDepth(-10);
    this.advance(0);
  }

  Backdrop.prototype.advance = function (deltaMs) {
    var t = this.clock + deltaMs / 1000;
    this.clock = t;
    this.scene.registry.set(CLOCK_SLOT, t);

    this.group.angle = 40 * Math.sin(t * 0.11);
    this.group.scaleX = 1 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.07));
    this.group.alpha = 0.88 + 0.06 * Math.sin(t * 0.09);
    this.group.x = this.frame.midX + Math.cos(t * 0.22) * DRIFT;
    this.group.y = this.frame.midY + Math.sin(t * 0.19) * DRIFT;
  };

  /** Lo que debe cubrir el bloque, para poder comprobarlo desde fuera. */
  Backdrop.prototype.coverage = function () {
    return {
      needed: this.frame.diagonal() + DRIFT * 2,
      width: this.stripeCount * STRIPE,
      height: this.span
    };
  };

  Backdrop.STRIPE = STRIPE;
  Backdrop.DRIFT = DRIFT;
  global.Backdrop = Backdrop;

})(window);
