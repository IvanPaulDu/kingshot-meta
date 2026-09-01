/*
 * rally.js — La partida.
 *
 * La esfera cae sobre una paleta inclinada que la desvía hacia una de las dos
 * columnas laterales; acierta si la columna es de su mismo color. El flujo se
 * lleva con una máquina de estados de cuatro fases y el aprendizaje guiado con
 * una cola de pasos que se consume sola.
 */
(function (global) {
  'use strict';

  var TILT = { right: 45, left: 125 };   // inclinaciones de la paleta, en grados

  // La velocidad de saque sube con el marcador siguiendo una curva que se
  // satura, en lugar de a tramos: rápida al principio y cada vez más plana.
  var SERVE_CEILING = 14;
  var SERVE_TAU = 60;

  var PHASE = { SERVING: 'serving', COACHING: 'coaching', LIVE: 'live', CLOSING: 'closing' };

  var OFFSCREEN = -600;

  function RallyScene() {
    global.Phaser.Scene.call(this, { key: 'rally' });
  }

  RallyScene.prototype = Object.create(global.Phaser.Scene.prototype);
  RallyScene.prototype.constructor = RallyScene;

  RallyScene.prototype.init = function (data) {
    this.coachQueue = (data && data.coaching) ? ['right', 'left'] : [];
    this.score = 0;
    this.serveSpeed = 0;
    this.phase = PHASE.SERVING;
    this.recoiled = false;
  };

  RallyScene.prototype.create = function () {
    var cfg = this.sys.game.config;
    var frame = new global.Frame(cfg.width, cfg.height);
    this.frame = frame;
    this.profile = this.registry.get('profile');
    this.jukebox = this.registry.get('jukebox');
    this.backdrop = new global.Backdrop(this, frame);

    // La velocidad elegida escala el reloj de la simulación, de modo que afecta
    // por igual a la caída, al rebote y al recorrido lateral.
    this.matter.world.engine.timing.timeScale = this.profile.tempoFactor;

    this.buildColumns();
    this.buildBlade();
    this.buildOrb();
    this.buildSteering();
    this.buildHud();
    this.buildCoachProps();

    this.cursors = this.input.keyboard.createCursorKeys();
    var self = this;
    this.input.on('pointerdown', function () { self.serve(); });
    this.input.keyboard.on('keydown', function () { self.serve(); });

    this.cameras.main.fadeIn(200);
    this.presentServe();
  };

  // ------------------------------------------------------------ Montaje ---

  RallyScene.prototype.buildColumns = function () {
    var opening = global.Chroma.openingPair();
    this.columnColor = { left: opening.left, right: opening.right };
    this.columns = {};

    var probe = this.add.image(0, 0, 'column');
    var thickness = probe.width;
    probe.destroy();

    var slots = { left: thickness / 2, right: this.frame.width - thickness / 2 };
    var self = this;
    ['left', 'right'].forEach(function (side) {
      var bar = self.add.image(slots[side], self.frame.midY, 'column');
      bar.setDisplaySize(thickness, self.frame.height);
      bar.setTint(global.Chroma.tint(self.columnColor[side]));
      self.columns[side] = bar;
    });
    this.columnThickness = thickness;
  };

  RallyScene.prototype.buildBlade = function () {
    var y = this.frame.band(0.66);
    this.blade = this.matter.add.image(this.frame.midX, y, 'blade');
    this.blade.setDepth(2);
    this.blade.setStatic(true);
    this.bladeShade = this.add.image(this.frame.midX, y + 8, 'bladeShade').setAlpha(0.5);
    this.tilt(TILT.left);
  };

  RallyScene.prototype.buildOrb = function () {
    this.orb = this.matter.add.image(this.frame.midX, 10, 'orb');
    this.orb.setDepth(2);
    this.orb.setCircle();
    this.orbShade = this.add.image(this.orb.x + 5, this.orb.y + 5, 'orbShade').setAlpha(0.5);
    this.dressOrb();
  };

  RallyScene.prototype.buildSteering = function () {
    var mirrored = this.profile.mirrored;
    var y = this.frame.bottom(100);

    // Al reflejar los mandos intercambian función e icono a la vez, de modo que
    // el dibujo sigue diciendo la verdad sobre hacia dónde saldrá la esfera.
    var eastSlot = this.add.image(this.frame.column(-60), y,
      mirrored ? 'steerLeft' : 'steerRight').setInteractive();
    var westSlot = this.add.image(60, y,
      mirrored ? 'steerRight' : 'steerLeft').setInteractive();

    this.steer = {
      right: mirrored ? westSlot : eastSlot,
      left: mirrored ? eastSlot : westSlot
    };

    var self = this;
    ['right', 'left'].forEach(function (aim) {
      var button = self.steer[aim];
      button.on('pointerdown', function () {
        self.tilt(TILT[aim]);
        self.tweens.add({
          targets: button, scaleX: 0.9, scaleY: 0.9, duration: 50, yoyo: true
        });
      });
    });
  };

  RallyScene.prototype.buildHud = function () {
    this.scoreLabel = this.add.bitmapText(OFFSCREEN, OFFSCREEN, 'numerals', '0')
      .setOrigin(0.5, 0.5);
    this.sparkle = this.add.image(OFFSCREEN, OFFSCREEN, 'sparkle').setAlpha(0).setDepth(1);
    this.shards = this.add.particles('shard');
    this.prompt = this.add.image(this.frame.midX, this.frame.midY, 'servePrompt').setDepth(3);
  };

  RallyScene.prototype.buildCoachProps = function () {
    var self = this;
    this.veil = this.add.image(OFFSCREEN, OFFSCREEN, 'veil').setOrigin(0, 0).setAlpha(0.8);
    this.spin = this.add.image(OFFSCREEN, OFFSCREEN, 'spinArrow').setOrigin(0.5);
    this.ring = this.add.image(OFFSCREEN, OFFSCREEN, 'tapRing').setInteractive();

    this.tweens.add({
      targets: this.ring, alpha: 0.3, scaleX: 1.25, scaleY: 1.25,
      duration: 200, yoyo: true, repeat: -1
    });
    this.tweens.add({ targets: this.spin, angle: 45, duration: 1500, repeat: -1 });

    // Parpadeos que señalan la esfera y la columna que hay que acertar.
    this.orbBeacon = this.add.image(OFFSCREEN, OFFSCREEN, 'orb').setDepth(3);
    this.columnBeacon = this.add.image(OFFSCREEN, OFFSCREEN, 'column')
      .setDisplaySize(this.columnThickness, this.frame.height);
    [this.orbBeacon, this.columnBeacon].forEach(function (beacon) {
      self.tweens.add({
        targets: beacon, alpha: 0, duration: 600, yoyo: true, ease: 'Power1', repeat: -1
      });
    });

    this.ring.on('pointerup', function () { self.consumeCoachStep(); });
  };

  // ------------------------------------------------------------- Estados ---

  RallyScene.prototype.presentServe = function () {
    this.orb.setStatic(true);
    this.orb.setPosition(this.frame.midX, 10);
    this.recoiled = false;

    if (this.coachQueue.length) { this.beginCoaching(); return; }

    this.phase = PHASE.SERVING;
    this.prompt.setPosition(this.frame.midX, this.frame.midY).setAlpha(0);
    this.tweens.add({ targets: this.prompt, alpha: 1, duration: 200 });
    this.promptPulse = this.tweens.add({
      targets: this.prompt, scaleX: 1.06, scaleY: 1.06,
      duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  };

  /** Suelta la esfera cuando el jugador toca o pulsa una tecla. */
  RallyScene.prototype.serve = function () {
    if (this.phase !== PHASE.SERVING) { return; }
    if (this.promptPulse) { this.promptPulse.stop(); this.promptPulse = null; }
    this.tweens.killTweensOf(this.prompt);
    this.prompt.setPosition(OFFSCREEN, OFFSCREEN);
    this.launch(0.7 + Math.random() * 0.2);
  };

  RallyScene.prototype.beginCoaching = function () {
    var aim = this.coachQueue[0];
    this.phase = PHASE.COACHING;

    // Durante el paso, la esfera lleva el color de la columna que se enseña.
    this.orbColor = this.columnColor[aim];
    this.orb.setTint(global.Chroma.tint(this.orbColor));

    this.veil.setPosition(0, 0).setFlipX(aim === 'left');
    this.spin.setPosition(this.blade.x, this.blade.y).setFlipX(aim === 'left');
    this.ring.setPosition(this.steer[aim].x, this.steer[aim].y);
    this.orbBeacon.setPosition(this.orb.x, this.orb.y).setTint(global.Chroma.tint(this.orbColor));
    this.columnBeacon.setPosition(this.columns[aim].x, this.columns[aim].y);

    this.tweens.add({
      targets: this.steer[aim], scaleX: 1.1, scaleY: 1.1,
      yoyo: true, duration: 250, ease: 'Power1', repeat: 4
    });
  };

  RallyScene.prototype.consumeCoachStep = function () {
    if (this.phase !== PHASE.COACHING) { return; }
    var aim = this.coachQueue.shift();
    this.tilt(TILT[aim]);
    [this.veil, this.spin, this.ring, this.orbBeacon, this.columnBeacon].forEach(function (prop) {
      prop.setPosition(OFFSCREEN, OFFSCREEN);
    });
    this.launch(0.7 + Math.random() * 0.2);
  };

  RallyScene.prototype.launch = function (bounce) {
    this.orb.setStatic(false);
    this.orb.setCircle();
    this.orb.setBounce(bounce);
    this.phase = PHASE.LIVE;
  };

  // -------------------------------------------------------------- Bucle ---

  RallyScene.prototype.update = function (time, delta) {
    this.backdrop.advance(delta);
    if (this.phase !== PHASE.LIVE) { return; }

    this.orbShade.setPosition(this.orb.x + 5, this.orb.y + 5);

    // El primer desvío lateral marca el golpe contra la paleta.
    if (!this.recoiled && Math.abs(this.orb.x - this.frame.midX) > 0.5) {
      this.recoiled = true;
      this.jukebox.cue('thud');
      this.recoil();
    }

    this.readKeys();

    if (this.orb.y > this.frame.height + 20) { this.reload(); }
    if (this.orb.x < 0) { this.resolve('left'); }
    else if (this.orb.x > this.frame.width) { this.resolve('right'); }
  };

  RallyScene.prototype.readKeys = function () {
    var mirrored = this.profile.mirrored;
    if (this.cursors.left.isDown) { this.tilt(mirrored ? TILT.right : TILT.left); }
    else if (this.cursors.right.isDown) { this.tilt(mirrored ? TILT.left : TILT.right); }
  };

  RallyScene.prototype.tilt = function (degrees) {
    this.blade.setAngle(degrees);
    this.bladeShade.setAngle(degrees);
  };

  RallyScene.prototype.recoil = function () {
    var self = this;
    [this.blade, this.bladeShade].forEach(function (piece) {
      self.tweens.add({
        targets: piece, y: piece.y + 6, duration: 40, yoyo: true, ease: 'Power2'
      });
    });
  };

  /** Devuelve la esfera arriba con la velocidad de saque que toca. */
  RallyScene.prototype.reload = function () {
    this.orb.setPosition(this.frame.midX, 10);
    this.orb.setVelocity(0, this.serveSpeed);
    this.orb.setAngle(0);
    this.orb.setBounce(0.8 + Math.random());
    this.recoiled = false;
  };

  RallyScene.prototype.resolve = function (side) {
    if (this.columnColor[side] === this.orbColor) { this.award(side); }
    else { this.collapse(); }
  };

  RallyScene.prototype.award = function (side) {
    this.score++;
    this.flash();
    this.jukebox.cue('chime');
    this.serveSpeed = SERVE_CEILING * (1 - Math.exp(-this.score / SERVE_TAU));
    this.reload();

    if (this.score % 2 === 0) { this.repaintColumn(); }
    this.dressOrb();
    this.postScore();

    if (this.coachQueue.length) {
      this.orb.setStatic(true);
      this.beginCoaching();
    }
  };

  /** Una de las dos columnas cambia a un tono distinto de los dos actuales. */
  RallyScene.prototype.repaintColumn = function () {
    var side = Math.random() < 0.5 ? 'left' : 'right';
    var next = global.Chroma.pickExcluding([this.columnColor.left, this.columnColor.right]);
    this.columnColor[side] = next;

    var bar = this.columns[side];
    var away = side === 'left' ? -this.columnThickness
      : this.frame.width + this.columnThickness;
    this.tweens.add({ targets: bar, x: away, duration: 100, yoyo: true });
    bar.setTint(global.Chroma.tint(next));
  };

  RallyScene.prototype.dressOrb = function () {
    var side;
    if (this.coachQueue.length) { side = this.coachQueue[0]; }
    else { side = Math.random() < 0.5 ? 'left' : 'right'; }
    this.orbColor = this.columnColor[side];
    this.orb.setTint(global.Chroma.tint(this.orbColor));
  };

  RallyScene.prototype.flash = function () {
    this.sparkle.setPosition(this.orb.x, this.orb.y);
    this.sparkle.setTint(global.Chroma.tint(this.orbColor));
    this.tweens.add({
      targets: this.sparkle,
      alpha: 0.6 + Math.random() * 0.2,
      scaleX: 1.8 + Math.random() * 0.4,
      scaleY: 1.8 + Math.random() * 0.4,
      duration: 40,
      yoyo: true
    });
  };

  RallyScene.prototype.postScore = function () {
    this.scoreLabel.setText(String(this.score));
    if (this.score < 50) {
      this.scoreLabel.setScale(1 + this.score / 100);
      this.scoreLabel.setPosition(this.frame.midX + this.score,
        this.frame.band(1 / 3) + this.score);
    }
    this.tweens.add({
      targets: this.scoreLabel,
      scaleX: this.scoreLabel.scaleX + 0.4,
      scaleY: this.scoreLabel.scaleY + 0.4,
      duration: 100, yoyo: true, ease: 'Power2'
    });
  };

  // ----------------------------------------------------------- Desenlace ---

  RallyScene.prototype.collapse = function () {
    this.phase = PHASE.CLOSING;
    var beatRecord = this.profile.submit(this.score);

    this.orbShade.setPosition(OFFSCREEN, OFFSCREEN);
    this.jukebox.cue('burst');
    this.scatter();

    var card = this.add.image(0, 0, 'endCard').setOrigin(0, 0).setAlpha(0).setDepth(2);
    var camera = this.cameras.main;
    var self = this;

    camera.shake(200);
    camera.once('camerashakecomplete', function () {
      if (self.score > 0) {
        self.tweens.add({
          targets: card, alpha: 1, duration: 900, ease: 'Power1',
          onComplete: function () { camera.fade(500); }
        });
      } else {
        camera.fade(500);
      }
    });
    camera.once('camerafadeoutcomplete', function () {
      self.scene.start('title', { celebrate: beatRecord });
    });
  };

  RallyScene.prototype.scatter = function () {
    var toTheLeft = this.orb.x < this.frame.midX;
    this.shards.createEmitter({
      scale: { start: 0.5, end: 2.5 },
      speed: 100,
      angle: toTheLeft ? { min: -90, max: 45 } : { min: 135, max: 270 },
      rotate: { min: -180, max: 180 },
      lifespan: { min: 200, max: 300 },
      frequency: 30,
      maxParticles: 4,
      x: this.orb.x + (toTheLeft ? 20 : -20),
      y: this.orb.y
    });
  };

  /** Instantánea para las pruebas automáticas. */
  RallyScene.prototype.snapshot = function () {
    return {
      scene: 'rally',
      phase: this.phase,
      score: this.score,
      coachQueue: this.coachQueue.slice(),
      orbX: Math.round(this.orb.x),
      orbY: Math.round(this.orb.y),
      orbHeld: this.orb.body ? this.orb.body.isStatic : null,
      bladeAngle: Math.round(this.blade.angle),
      promptVisible: this.prompt.x > 0,
      steerRightAt: { x: Math.round(this.steer.right.x), y: Math.round(this.steer.right.y) },
      steerLeftAt: { x: Math.round(this.steer.left.x), y: Math.round(this.steer.left.y) },
      steerRightIcon: this.steer.right.texture.key,
      steerLeftIcon: this.steer.left.texture.key,
      ringAt: { x: Math.round(this.ring.x), y: Math.round(this.ring.y) },
      timeScale: this.matter.world.engine.timing.timeScale
    };
  };

  RallyScene.TILT = TILT;
  RallyScene.PHASE = PHASE;
  global.RallyScene = RallyScene;

})(window);
