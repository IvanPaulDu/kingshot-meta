/*
 * widgets.js — Controles de interfaz sobre el lienzo.
 *
 * Cada control expone `nodes` (lo que se dibuja) y `hotspots` (lo que recibe
 * toques). Una `Overlay` adopta controles y se encarga en un solo sitio de
 * mostrarlos, ocultarlos y encaminar el arrastre, de modo que ningún control
 * registra escuchadores globales por su cuenta.
 */
(function (global) {
  'use strict';

  var FACE = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  var RAIL_WIDTH = 232;

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /**
   * Texto nítido. Se rasteriza al triple de tamaño y se muestra a escala 1:1,
   * porque el lienzo de 320 px se amplía mucho al llegar a la pantalla.
   */
  function caption(scene, x, y, value, opts) {
    var node = scene.add.text(x, y, value, {
      fontFamily: FACE,
      fontSize: (opts.size || 15) + 'px',
      fontStyle: 'bold',
      color: opts.color || '#ffffff',
      resolution: 3
    });
    node.setOrigin(opts.align === 'right' ? 1 : (opts.align === 'center' ? 0.5 : 0), 0.5);
    return node;
  }

  // -------------------------------------------------------------- Slider ---

  /**
   * Barra deslizante discreta. `steps` es el número de posiciones posibles;
   * encajar en pasos permite fijar los extremos con el dedo, que sobre 232 px
   * de riel nunca acierta el píxel exacto.
   */
  function Slider(scene, spec) {
    var left = spec.x - RAIL_WIDTH / 2;
    this.scene = scene;
    this.left = left;
    this.steps = spec.steps;
    this.onChange = spec.onChange;
    this.value = spec.value;

    this.track = scene.add.image(spec.x, spec.y, 'rail').setTint(0x4a505c);
    this.fill = scene.add.image(left, spec.y, 'rail').setOrigin(0, 0.5)
      .setTint(global.Chroma.tint(1));
    this.knob = scene.add.image(left, spec.y, 'grip');
    this.zone = scene.add.zone(spec.x, spec.y, RAIL_WIDTH + 44, 46)
      .setOrigin(0.5).setInteractive();

    this.nodes = [this.track, this.fill, this.knob, this.zone];
    this.hotspots = [this.zone];
    this.sync();
  }

  Slider.prototype.sync = function () {
    // Se recorta en vez de estirar, para que el remate redondeado de la
    // izquierda no se deforme con valores pequeños.
    this.fill.setCrop(0, 0, Math.max(0.0001, this.value) * RAIL_WIDTH, 12);
    this.knob.x = this.left + this.value * RAIL_WIDTH;
  };

  Slider.prototype.set = function (value) {
    this.value = clamp01(value);
    this.sync();
  };

  /** Traduce una posición de puntero a valor; devuelve true si cambió. */
  Slider.prototype.aimAt = function (pointerX) {
    var raw = clamp01((pointerX - this.left) / RAIL_WIDTH);
    var snapped = Math.round(raw * (this.steps - 1)) / (this.steps - 1);
    if (snapped === this.value) { return false; }
    this.value = snapped;
    this.sync();
    this.onChange(snapped);
    return true;
  };

  // -------------------------------------------------------------- Switch ---

  function Switch(scene, spec) {
    this.scene = scene;
    this.home = spec.x;
    this.state = spec.value;
    this.onChange = spec.onChange;

    this.body = scene.add.image(spec.x, spec.y, 'switchOff');
    this.knob = scene.add.image(spec.x, spec.y, 'switchGrip');
    this.zone = scene.add.zone(spec.x, spec.y, 78, 46).setOrigin(0.5).setInteractive();

    var self = this;
    this.zone.on('pointerup', function () {
      self.state = !self.state;
      self.body.setTexture(self.state ? 'switchOn' : 'switchOff');
      scene.tweens.add({
        targets: self.knob, x: self.home + (self.state ? 15 : -15),
        duration: 110, ease: 'Power2'
      });
      self.onChange(self.state);
    });

    this.nodes = [this.body, this.knob, this.zone];
    this.hotspots = [this.zone];
    this.sync();
  }

  Switch.prototype.sync = function () {
    this.body.setTexture(this.state ? 'switchOn' : 'switchOff');
    this.knob.x = this.home + (this.state ? 15 : -15);
  };

  Switch.prototype.set = function (value) {
    this.state = !!value;
    this.sync();
  };

  // -------------------------------------------------------------- Button ---

  function Button(scene, spec) {
    this.face = scene.add.image(spec.x, spec.y, 'pill').setInteractive();
    this.text = caption(scene, spec.x, spec.y, spec.label, { size: 15, align: 'center' });
    var parts = [this.face, this.text];
    this.face.on('pointerup', function () {
      scene.tweens.add({
        targets: parts, scaleX: 0.94, scaleY: 0.94, duration: 70, yoyo: true,
        onComplete: spec.onPress
      });
    });
    this.nodes = parts;
    this.hotspots = [this.face];
  }

  // ------------------------------------------------------------- Overlay ---

  function Overlay(scene) {
    this.scene = scene;
    this.nodes = [];
    this.hotspots = [];
    this.sliders = [];
    this.open = false;
    this.dragging = null;
    this.depth = 20;

    var self = this;
    scene.input.on('pointermove', function (pointer) {
      if (self.open && self.dragging && pointer.isDown) { self.dragging.aimAt(pointer.x); }
    });
    scene.input.on('pointerup', function () { self.dragging = null; });
  }

  Overlay.prototype.adopt = function (widget) {
    var self = this;
    this.nodes = this.nodes.concat(widget.nodes || [widget]);
    this.hotspots = this.hotspots.concat(widget.hotspots || []);
    if (widget instanceof Slider) {
      this.sliders.push(widget);
      widget.zone.on('pointerdown', function (pointer) {
        self.dragging = widget;
        widget.aimAt(pointer.x);
      });
    }
    return widget;
  };

  Overlay.prototype.seal = function () {
    var self = this;
    this.nodes.forEach(function (node) {
      node.setDepth(self.depth);
      node.visible = false;
      node.alpha = 0;
    });
    this.hotspots.forEach(function (spot) { spot.disableInteractive(); });
  };

  Overlay.prototype.reveal = function (onSync) {
    this.open = true;
    this.nodes.forEach(function (node) { node.visible = true; });
    if (onSync) { onSync(); }
    this.hotspots.forEach(function (spot) { spot.setInteractive(); });
    this.scene.tweens.add({ targets: this.nodes, alpha: 1, duration: 120 });
  };

  Overlay.prototype.dismiss = function () {
    this.open = false;
    this.dragging = null;
    this.hotspots.forEach(function (spot) { spot.disableInteractive(); });
    var nodes = this.nodes;
    this.scene.tweens.add({
      targets: nodes, alpha: 0, duration: 120,
      onComplete: function () { nodes.forEach(function (node) { node.visible = false; }); }
    });
  };

  global.Ui = {
    caption: caption,
    Slider: Slider,
    Switch: Switch,
    Button: Button,
    Overlay: Overlay,
    RAIL_WIDTH: RAIL_WIDTH
  };

})(window);
