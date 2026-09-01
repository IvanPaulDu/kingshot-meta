/*
 * title.js — Portada, récord y panel de opciones.
 */
(function (global) {
  'use strict';

  var OFFSCREEN = -600;

  function TitleScene() {
    global.Phaser.Scene.call(this, { key: 'title' });
  }

  TitleScene.prototype = Object.create(global.Phaser.Scene.prototype);
  TitleScene.prototype.constructor = TitleScene;

  TitleScene.prototype.init = function (data) {
    this.celebrate = !!(data && data.celebrate);
  };

  TitleScene.prototype.create = function () {
    var cfg = this.sys.game.config;
    this.frame = new global.Frame(cfg.width, cfg.height);
    this.profile = this.registry.get('profile');
    this.jukebox = this.registry.get('jukebox');
    this.backdrop = new global.Backdrop(this, this.frame);
    this.cameras.main.fadeIn(180);

    this.buildMasthead();
    this.buildCorners();
    this.buildRecord();
    this.buildOptions();
  };

  TitleScene.prototype.update = function (time, delta) {
    this.backdrop.advance(delta);
  };

  // ------------------------------------------------------------ Portada ---

  TitleScene.prototype.buildMasthead = function () {
    var self = this;
    this.wordmark = this.add.image(this.frame.midX, this.frame.band(0.2), 'wordmark');
    this.playButton = this.add.image(this.frame.midX, this.frame.midY, 'playPill')
      .setInteractive();

    this.playButton.once('pointerup', function () {
      self.tweens.add({
        targets: self.playButton, scaleX: 0.9, scaleY: 0.9, duration: 100, yoyo: true,
        onComplete: function () { self.toMatch(self.profile.needsCoaching); }
      });
    });
  };

  TitleScene.prototype.toMatch = function (withCoaching) {
    this.scene.start('rally', { coaching: !!withCoaching });
  };

  TitleScene.prototype.buildCorners = function () {
    var self = this;
    var y = this.frame.bottom(29);

    this.soundButton = this.add.image(29, y,
      this.profile.musicAudible ? 'soundOn' : 'soundOff').setInteractive();
    this.soundButton.on('pointerup', function () {
      self.profile.toggleMusic();
      self.jukebox.syncMusic();
      self.refreshSoundIcon();
      if (self.options && self.options.open) { self.music.set(self.profile.musicLevel); }
    });

    this.gearButton = this.add.image(81, y, 'gear').setInteractive();
    this.gearButton.on('pointerup', function () {
      if (self.options.open) { self.closeOptions(); } else { self.openOptions(); }
    });
  };

  TitleScene.prototype.refreshSoundIcon = function () {
    this.soundButton.setTexture(this.profile.musicAudible ? 'soundOn' : 'soundOff');
  };

  TitleScene.prototype.buildRecord = function () {
    if (this.profile.record <= 0) { this.recordPlate = null; return; }

    var y = this.frame.bottom(96);
    this.recordPlate = this.add.image(this.frame.midX, y, 'recordBar');
    this.recordDigits = this.add.bitmapText(this.frame.midX + 22, y - 2,
      'numerals', String(this.profile.record)).setOrigin(0.5).setScale(0.5);

    if (this.celebrate) {
      this.tweens.add({
        targets: this.recordDigits, scaleX: 0.6, scaleY: 0.6,
        duration: 150, yoyo: true, repeat: 1
      });
    }
  };

  // ------------------------------------------------------------ Opciones ---

  TitleScene.prototype.buildOptions = function () {
    var self = this;
    var midX = this.frame.midX;
    var midY = this.frame.midY;
    var Ui = global.Ui;

    this.options = new Ui.Overlay(this);
    this.options.adopt(this.add.image(midX, midY, 'panel'));
    this.options.adopt(Ui.caption(this, midX, midY - 150, 'OPCIONES',
      { size: 22, align: 'center' }));

    var rows = [
      {
        title: 'Música', y: midY - 118, steps: 21,
        read: function () { return self.profile.musicLevel; },
        show: function () { return Math.round(self.profile.musicLevel * 100) + '%'; },
        write: function (v) {
          self.profile.musicLevel = v;
          self.jukebox.syncMusic();
          self.refreshSoundIcon();
        }
      },
      {
        title: 'Efectos', y: midY - 66, steps: 21,
        read: function () { return self.profile.effectsLevel; },
        show: function () { return Math.round(self.profile.effectsLevel * 100) + '%'; },
        write: function (v) { self.profile.effectsLevel = v; self.jukebox.preview(); }
      },
      {
        title: 'Velocidad', y: midY - 14, steps: global.Profile.TEMPOS.length,
        read: function () {
          return self.profile.tempoIndex / (global.Profile.TEMPOS.length - 1);
        },
        show: function () { return self.profile.tempoLabel; },
        write: function (v) {
          self.profile.tempoIndex = Math.round(v * (global.Profile.TEMPOS.length - 1));
        }
      }
    ];

    this.readouts = [];
    this.dials = {};

    rows.forEach(function (row) {
      self.options.adopt(Ui.caption(self, midX - 116, row.y, row.title, { size: 15 }));
      var readout = self.options.adopt(
        Ui.caption(self, midX + 116, row.y, row.show(),
          { size: 15, align: 'right', color: global.Chroma.css(1) }));

      var dial = self.options.adopt(new Ui.Slider(self, {
        x: midX, y: row.y + 24, value: row.read(), steps: row.steps,
        onChange: function (v) { row.write(v); self.refreshReadouts(); }
      }));

      self.readouts.push({ readout: readout, show: row.show, dial: dial, read: row.read });
    });
    this.music = this.readouts[0].dial;

    this.options.adopt(Ui.caption(this, midX - 116, midY + 48, 'Mandos reflejados', { size: 15 }));
    this.mirrorSwitch = this.options.adopt(new Ui.Switch(this, {
      x: midX + 92, y: midY + 48, value: this.profile.mirrored,
      onChange: function (v) { self.profile.mirrored = v; }
    }));

    this.options.adopt(new Ui.Button(this, {
      x: midX, y: midY + 94, label: 'VER TUTORIAL',
      onPress: function () { self.closeOptions(); self.toMatch(true); }
    }));
    this.options.adopt(new Ui.Button(this, {
      x: midX, y: midY + 144, label: 'CERRAR',
      onPress: function () { self.closeOptions(); }
    }));

    this.options.seal();
  };

  TitleScene.prototype.refreshReadouts = function () {
    this.readouts.forEach(function (row) { row.readout.setText(row.show()); });
  };

  TitleScene.prototype.menuPieces = function () {
    var pieces = [this.wordmark, this.playButton, this.soundButton, this.gearButton];
    if (this.recordPlate) { pieces.push(this.recordPlate, this.recordDigits); }
    return pieces;
  };

  TitleScene.prototype.openOptions = function () {
    var self = this;
    this.menuPieces().forEach(function (piece) {
      if (piece.disableInteractive) { piece.disableInteractive(); }
      self.tweens.add({ targets: piece, alpha: 0, duration: 120 });
    });
    this.options.reveal(function () {
      self.readouts.forEach(function (row) { row.dial.set(row.read()); });
      self.mirrorSwitch.set(self.profile.mirrored);
      self.refreshReadouts();
    });
  };

  TitleScene.prototype.closeOptions = function () {
    var self = this;
    this.options.dismiss();
    this.menuPieces().forEach(function (piece) {
      self.tweens.add({ targets: piece, alpha: 1, duration: 120 });
      if (piece.setInteractive && piece !== self.wordmark
          && piece !== self.recordPlate && piece !== self.recordDigits) {
        piece.setInteractive();
      }
    });
  };

  /** Instantánea para las pruebas automáticas. */
  TitleScene.prototype.snapshot = function () {
    return {
      scene: 'title',
      record: this.profile.record,
      optionsOpen: this.options.open,
      playAt: { x: Math.round(this.playButton.x), y: Math.round(this.playButton.y) },
      playAlpha: this.playButton.alpha,
      soundAt: { x: Math.round(this.soundButton.x), y: Math.round(this.soundButton.y) },
      soundIcon: this.soundButton.texture.key,
      gearAt: { x: Math.round(this.gearButton.x), y: Math.round(this.gearButton.y) },
      switchIcon: this.mirrorSwitch.body.texture.key,
      hasRecordPlate: !!this.recordPlate
    };
  };

  global.TitleScene = TitleScene;

})(window);
