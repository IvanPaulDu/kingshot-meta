/*
 * profile.js — Perfil del jugador guardado en el dispositivo.
 *
 * Un único registro versionado. Al leer se fusiona con los valores por defecto,
 * de modo que un perfil escrito por una versión anterior nunca deja huecos.
 */
(function (global) {
  'use strict';

  var SLOT = 'vaiven.profile';
  var VERSION = 1;

  var TEMPOS = [
    { label: 'Muy lenta', factor: 0.70 },
    { label: 'Lenta',     factor: 0.85 },
    { label: 'Normal',    factor: 1.00 },
    { label: 'Rápida',    factor: 1.15 },
    { label: 'Muy rápida', factor: 1.30 }
  ];

  function blank() {
    return {
      version: VERSION,
      record: 0,
      volume: { music: 0.8, effects: 0.9 },
      tempo: 2,
      mirroredSteering: false
    };
  }

  function clamp(value, low, high) {
    return value < low ? low : (value > high ? high : value);
  }

  function Profile() {
    this.data = blank();
    this.mutedLevel = 0.8;   // nivel al que vuelve la música tras silenciarla
  }

  Profile.prototype = {
    load: function () {
      var stored = null;
      try { stored = JSON.parse(global.localStorage.getItem(SLOT)); } catch (err) { stored = null; }
      var fresh = blank();
      if (stored && typeof stored === 'object') {
        if (typeof stored.record === 'number') { fresh.record = Math.max(0, stored.record | 0); }
        if (typeof stored.tempo === 'number') { fresh.tempo = clamp(stored.tempo | 0, 0, TEMPOS.length - 1); }
        if (typeof stored.mirroredSteering === 'boolean') { fresh.mirroredSteering = stored.mirroredSteering; }
        if (stored.volume) {
          if (typeof stored.volume.music === 'number') { fresh.volume.music = clamp(stored.volume.music, 0, 1); }
          if (typeof stored.volume.effects === 'number') { fresh.volume.effects = clamp(stored.volume.effects, 0, 1); }
        }
      }
      this.data = fresh;
      if (fresh.volume.music > 0) { this.mutedLevel = fresh.volume.music; }
      return this.data;
    },

    save: function () {
      try { global.localStorage.setItem(SLOT, JSON.stringify(this.data)); } catch (err) { /* modo privado */ }
    },

    get record() { return this.data.record; },

    /** Registra una puntuación; devuelve true si ha batido el récord. */
    submit: function (score) {
      if (score <= this.data.record) { this.save(); return false; }
      this.data.record = score;
      this.save();
      return true;
    },

    get musicLevel() { return this.data.volume.music; },
    set musicLevel(value) {
      this.data.volume.music = clamp(value, 0, 1);
      if (value > 0) { this.mutedLevel = value; }
      this.save();
    },

    get effectsLevel() { return this.data.volume.effects; },
    set effectsLevel(value) { this.data.volume.effects = clamp(value, 0, 1); this.save(); },

    get musicAudible() { return this.data.volume.music > 0; },

    /** Alterna entre silencio y el último nivel audible. */
    toggleMusic: function () {
      this.musicLevel = this.musicAudible ? 0 : (this.mutedLevel || 0.8);
      return this.musicAudible;
    },

    get tempoIndex() { return this.data.tempo; },
    set tempoIndex(value) { this.data.tempo = clamp(value | 0, 0, TEMPOS.length - 1); this.save(); },
    get tempoFactor() { return TEMPOS[this.data.tempo].factor; },
    get tempoLabel() { return TEMPOS[this.data.tempo].label; },

    get mirrored() { return this.data.mirroredSteering; },
    set mirrored(value) { this.data.mirroredSteering = !!value; this.save(); },

    /** El aprendizaje guiado se ofrece solo mientras el jugador es nuevo. */
    get needsCoaching() { return this.data.record < 4; }
  };

  Profile.TEMPOS = TEMPOS;
  Profile.SLOT = SLOT;
  global.Profile = Profile;

})(window);
