/*
 * jukebox.js — Único punto por el que suena el juego.
 *
 * Se crea una sola vez al arrancar y sobrevive a los cambios de escena. El
 * nivel de música y el de efectos viven en el perfil; aquí solo se aplican.
 */
(function (global) {
  'use strict';

  var CUES = ['chime', 'thud', 'burst'];

  function Jukebox(scene, profile) {
    this.profile = profile;
    this.loop = scene.sound.add('loop', { loop: true, volume: profile.musicLevel });
    this.cues = {};
    var self = this;
    CUES.forEach(function (key) { self.cues[key] = scene.sound.add(key); });
  }

  Jukebox.prototype = {
    /** Arranca, para o reajusta la música según el nivel guardado. */
    syncMusic: function () {
      var level = this.profile.musicLevel;
      this.loop.setVolume(level);
      if (level > 0) {
        if (!this.loop.isPlaying) { this.loop.play(); }
      } else if (this.loop.isPlaying) {
        this.loop.stop();
      }
    },

    cue: function (key) {
      var level = this.profile.effectsLevel;
      if (level <= 0) { return; }
      var sound = this.cues[key];
      if (!sound) { return; }
      sound.setVolume(level);
      sound.play();
    },

    /** Muestra audible de los efectos mientras se ajusta su nivel. */
    preview: function () {
      var sound = this.cues.chime;
      if (this.profile.effectsLevel > 0 && !sound.isPlaying) { this.cue('chime'); }
    }
  };

  global.Jukebox = Jukebox;

})(window);
