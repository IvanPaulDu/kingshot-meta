/*
 * soundforge.js — Síntesis del sonido del juego.
 *
 * Cada pieza se describe como una lista de eventos (cuándo, qué nota, con qué
 * timbre y con qué envolvente) y un único paso de render las mezcla en un
 * búfer. El búfer se inyecta en la caché de audio de Phaser, que es justo lo
 * que espera su reproductor de Web Audio; si no hubiera Web Audio se cae a
 * etiquetas <audio> con un WAV incrustado.
 */
(function (global) {
  'use strict';

  // ------------------------------------------------------------- Timbres ---

  var WAVEFORMS = {
    sine: function (phase) { return Math.sin(phase * Math.PI * 2); },
    square: function (phase, duty) { return (phase % 1) < duty ? 1 : -1; },
    saw: function (phase) { return 2 * (phase % 1) - 1; },
    noise: function () { return Math.random() * 2 - 1; }
  };

  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  /**
   * Mezcla un evento en el búfer.
   * event: { at, span, note|freq, wave, duty, gain, decay, attack, glide, damp }
   */
  function lay(buffer, rate, event) {
    var wave = WAVEFORMS[event.wave || 'square'];
    var duty = event.duty === undefined ? 0.5 : event.duty;
    var attack = event.attack === undefined ? 0.004 : event.attack;
    var decay = event.decay === undefined ? 8 : event.decay;
    var gain = event.gain === undefined ? 0.2 : event.gain;
    var damp = event.damp === undefined ? 1 : event.damp;   // filtro de un polo
    var from = event.freq !== undefined ? event.freq : hz(event.note);
    var to = event.glide === undefined ? from : event.glide;

    var first = Math.floor(event.at * rate);
    var count = Math.floor(event.span * rate);
    var phase = 0;
    var filtered = 0;

    for (var i = 0; i < count; i++) {
      var slot = first + i;
      if (slot < 0 || slot >= buffer.length) { continue; }
      var t = i / rate;
      var progress = t / event.span;
      phase += (from + (to - from) * (progress > 1 ? 1 : progress)) / rate;

      var value = wave(phase, duty);
      if (damp < 1) {
        filtered += (value - filtered) * damp;
        value = filtered;
      }
      var shape = Math.exp(-t * decay);
      if (t < attack) { shape *= t / attack; }
      buffer[slot] += value * shape * gain;
    }
  }

  function render(seconds, rate, events) {
    var buffer = new Float32Array(Math.max(1, Math.round(seconds * rate)));
    for (var i = 0; i < events.length; i++) { lay(buffer, rate, events[i]); }
    for (var s = 0; s < buffer.length; s++) {
      buffer[s] = Math.tanh(buffer[s] * 1.15) / 1.15;   // limitador suave
    }
    return buffer;
  }

  // -------------------------------------------------------------- Piezas ---

  var PIECES = {};

  // Golpe de la esfera contra la paleta.
  PIECES.thud = {
    seconds: 0.14,
    score: function () {
      return [
        { at: 0, span: 0.11, freq: 205, glide: 68, wave: 'sine', decay: 34, gain: 0.6 },
        { at: 0, span: 0.02, freq: 900, wave: 'noise', decay: 120, gain: 0.2 }
      ];
    }
  };

  // Acierto de color.
  PIECES.chime = {
    seconds: 0.24,
    score: function () {
      return [
        { at: 0, span: 0.07, note: 76, wave: 'square', duty: 0.3, decay: 16, gain: 0.3, damp: 0.55 },
        { at: 0.055, span: 0.15, note: 83, wave: 'square', duty: 0.3, decay: 13, gain: 0.3, damp: 0.55 },
        { at: 0.055, span: 0.15, note: 88, wave: 'sine', decay: 14, gain: 0.16 }
      ];
    }
  };

  // Fallo: fin de la partida.
  PIECES.burst = {
    seconds: 0.6,
    score: function () {
      return [
        { at: 0, span: 0.55, freq: 3000, wave: 'noise', decay: 8, gain: 0.48, damp: 0.32 },
        { at: 0, span: 0.5, freq: 190, glide: 42, wave: 'sine', decay: 6, gain: 0.6 },
        { at: 0, span: 0.28, freq: 96, wave: 'square', decay: 11, gain: 0.28, damp: 0.2 }
      ];
    }
  };

  // Bucle de fondo: cuatro compases en re menor a 112 pulsos por minuto.
  var BPM = 112;
  var STEP = (60 / BPM) / 4;
  var BARS = 4;

  var CHANGES = [
    { root: 38, triad: [62, 65, 69] },   // Re menor
    { root: 34, triad: [58, 62, 65] },   // Si bemol
    { root: 41, triad: [53, 57, 60] },   // Fa
    { root: 36, triad: [60, 64, 67] }    // Do
  ];

  PIECES.loop = {
    seconds: BARS * 16 * STEP,
    score: function () {
      var events = [];
      for (var bar = 0; bar < BARS; bar++) {
        var chord = CHANGES[bar % CHANGES.length];
        for (var step = 0; step < 16; step++) {
          var at = (bar * 16 + step) * STEP;

          if (step % 2 === 0) {                       // bajo en corcheas
            var octaveUp = (step === 6 || step === 14);
            events.push({
              at: at, span: STEP * 1.7, note: chord.root + (octaveUp ? 12 : 0),
              wave: 'square', decay: 7, gain: 0.28, damp: 0.35
            });
          }

          events.push({                               // arpegio en semicorcheas
            at: at, span: STEP * 1.3,
            note: chord.triad[step % chord.triad.length] + (step >= 8 ? 12 : 0),
            wave: 'square', duty: 0.25, decay: 13, gain: 0.11, damp: 0.6
          });

          if (step === 0 || step === 8) {             // bombo
            events.push({ at: at, span: 0.16, freq: 128, glide: 45, wave: 'sine', decay: 22, gain: 0.48 });
          }
          if (step === 4 || step === 12) {            // caja
            events.push({ at: at, span: 0.13, freq: 2200, wave: 'noise', decay: 26, gain: 0.19, damp: 0.5 });
            events.push({ at: at, span: 0.09, freq: 180, wave: 'sine', decay: 30, gain: 0.17 });
          }
          if (step % 4 === 2) {                       // charles
            events.push({ at: at, span: 0.05, freq: 6000, wave: 'noise', decay: 65, gain: 0.085 });
          }
        }
        for (var v = 0; v < chord.triad.length; v++) {  // colchón
          events.push({
            at: bar * 16 * STEP, span: 16 * STEP, note: chord.triad[v] - 12,
            wave: 'sine', attack: 0.08, decay: 1.1, gain: 0.07
          });
        }
      }
      return events;
    }
  };

  // ------------------------------------------------------- Empaquetado ----

  function toWavUrl(samples, rate) {
    var bytes = new ArrayBuffer(44 + samples.length * 2);
    var view = new DataView(bytes);
    var tag = function (offset, text) {
      for (var i = 0; i < text.length; i++) { view.setUint8(offset + i, text.charCodeAt(i)); }
    };
    tag(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); tag(8, 'WAVE');
    tag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    tag(36, 'data'); view.setUint32(40, samples.length * 2, true);
    for (var i = 0; i < samples.length; i++) {
      var v = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
    var raw = new Uint8Array(bytes);
    var binary = '';
    for (var j = 0; j < raw.length; j += 0x8000) {
      binary += String.fromCharCode.apply(null, raw.subarray(j, j + 0x8000));
    }
    return 'data:audio/wav;base64,' + global.btoa(binary);
  }

  global.SoundForge = {
    KEYS: Object.keys(PIECES),
    loopSeconds: PIECES.loop.seconds,

    /** Sintetiza y registra en la caché de audio lo que aún no exista. */
    build: function (scene) {
      var context = scene.sound && scene.sound.context;
      var rate = (context && context.sampleRate) || 44100;

      Object.keys(PIECES).forEach(function (key) {
        if (scene.cache.audio.exists(key)) { return; }
        var piece = PIECES[key];
        var samples = render(piece.seconds, rate, piece.score());

        if (context && context.createBuffer) {
          var audioBuffer = context.createBuffer(1, samples.length, rate);
          audioBuffer.getChannelData(0).set(samples);
          scene.cache.audio.add(key, audioBuffer);
        } else {
          var url = toWavUrl(samples, rate);
          var tags = [];
          for (var i = 0; i < 4; i++) {
            var el = new Audio();
            el.src = url;
            el.preload = 'auto';
            el.load();
            tags.push(el);
          }
          scene.cache.audio.add(key, tags);
        }
      });
    }
  };

})(window);
