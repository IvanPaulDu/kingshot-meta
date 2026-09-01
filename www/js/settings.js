/*
 * settings.js — Estado persistente y menú de ajustes de SELEKTOR.
 *
 * Guarda un único registro en localStorage ('selektorFile'), el mismo que
 * usaba el juego original, ampliado con los ajustes nuevos. Los registros
 * antiguos (solo bestScore y musicStatus) se siguen leyendo sin problema.
 */
(function (global) {
  'use strict';

  var KEY = 'selektorFile';
  var FONT = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  // Multiplicadores de la escala de tiempo de Matter.
  var SPEEDS = [0.7, 0.85, 1.0, 1.15, 1.3];
  var SPEED_LABELS = ['Muy lenta', 'Lenta', 'Normal', 'Rápida', 'Muy rápida'];

  var defaults = {
    bestScore: 0,
    musicStatus: 1,
    musicVolume: 0.8,
    sfxVolume: 0.9,
    speedIndex: 2,
    invertControls: false
  };

  var values = {};

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function load() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    for (var k in defaults) { values[k] = defaults[k]; }
    if (!raw) { return values; }

    if (typeof raw.bestScore === 'number') { values.bestScore = raw.bestScore; }
    if (typeof raw.musicStatus === 'number') { values.musicStatus = raw.musicStatus; }
    if (typeof raw.musicVolume === 'number') { values.musicVolume = clamp01(raw.musicVolume); }
    else if (values.musicStatus === 0) { values.musicVolume = 0; }  // registro antiguo silenciado
    if (typeof raw.sfxVolume === 'number') { values.sfxVolume = clamp01(raw.sfxVolume); }
    if (typeof raw.speedIndex === 'number') {
      values.speedIndex = Math.max(0, Math.min(SPEEDS.length - 1, raw.speedIndex | 0));
    }
    if (typeof raw.invertControls === 'boolean') { values.invertControls = raw.invertControls; }

    values.musicStatus = values.musicVolume > 0 ? 1 : 0;
    return values;
  }

  function save() {
    values.musicStatus = values.musicVolume > 0 ? 1 : 0;
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch (e) { /* modo privado */ }
  }

  // -------------------------------------------------------------------
  // Widgets
  // -------------------------------------------------------------------

  function text(scene, x, y, str, size, color, align) {
    var t = scene.add.text(x, y, str, {
      fontFamily: FONT,
      fontSize: size + 'px',
      fontStyle: 'bold',
      color: color,
      // Se renderiza a 3x y se muestra a 1x: el lienzo de 320x480 se amplía
      // mucho por CSS y así el texto no sale borroso.
      resolution: 3
    });
    t.setOrigin(align === 'right' ? 1 : (align === 'center' ? 0.5 : 0), 0.5);
    return t;
  }

  var TRACK_W = 232;
  var VOL_STEPS = 21;      // 0 %, 5 %, ... 100 %

  /**
   * Deslizador horizontal. `steps` > 0 lo hace discreto (encaja en n valores).
   * Devuelve { objs, set } para que el panel pueda mostrarlo y refrescarlo.
   */
  function slider(scene, cx, cy, value, steps, onChange) {
    var left = cx - TRACK_W / 2;

    var bg = scene.add.image(cx, cy, 'ui_track').setTint(0x4a505c);
    var fill = scene.add.image(left, cy, 'ui_track').setOrigin(0, 0.5).setTint(0xf4c329);
    var knob = scene.add.image(left, cy, 'ui_knob');
    // Zona de toque generosa: en un lienzo de 320px el dedo no es preciso.
    var zone = scene.add.zone(cx, cy, TRACK_W + 44, 46).setOrigin(0.5).setInteractive();

    var current = value;

    function render() {
      // Se recorta en vez de estirar para que el extremo redondeado izquierdo
      // no se deforme con valores pequeños.
      fill.setCrop(0, 0, Math.max(0.0001, current) * TRACK_W, 12);
      fill.visible = current > 0.001;
      knob.x = left + current * TRACK_W;
    }

    function applyPointer(pointer) {
      var t = clamp01((pointer.x - left) / TRACK_W);
      if (steps) { t = Math.round(t * (steps - 1)) / (steps - 1); }
      if (t === current) { return; }
      current = t;
      render();
      onChange(current);
    }

    zone.on('pointerdown', function (pointer) {
      slider.activo = zone;
      applyPointer(pointer);
    });
    scene.input.on('pointermove', function (pointer) {
      if (slider.activo === zone && pointer.isDown && zone.visible) { applyPointer(pointer); }
    });
    scene.input.on('pointerup', function () {
      if (slider.activo === zone) { slider.activo = null; }
    });

    render();
    return {
      objs: [bg, fill, knob, zone],
      interactivos: [zone],
      set: function (v) { current = v; render(); }
    };
  }

  /**
   * Interruptor de dos estados. Es una sola imagen que cambia de textura: con
   * dos imágenes superpuestas, el degradado de apertura del panel las ponía a
   * ambas visibles y el interruptor se veía siempre encendido.
   */
  function toggle(scene, cx, cy, value, onChange) {
    var base = scene.add.image(cx, cy, 'ui_switch_off');
    var knob = scene.add.image(cx, cy, 'ui_switch_knob');
    var zone = scene.add.zone(cx, cy, 78, 46).setOrigin(0.5).setInteractive();
    var current = value;

    function render() {
      base.setTexture(current ? 'ui_switch_on' : 'ui_switch_off');
      knob.x = cx + (current ? 15 : -15);
    }

    zone.on('pointerup', function () {
      current = !current;
      base.setTexture(current ? 'ui_switch_on' : 'ui_switch_off');
      scene.tweens.add({ targets: knob, x: cx + (current ? 15 : -15), duration: 110, ease: 'Power2' });
      onChange(current);
    });

    render();
    return { objs: [base, knob, zone], interactivos: [zone], set: function (v) { current = v; render(); } };
  }

  /** Botón con rótulo. */
  function button(scene, cx, cy, rotulo, onPress) {
    var img = scene.add.image(cx, cy, 'ui_boton').setInteractive();
    var lbl = text(scene, cx, cy, rotulo, 15, '#ffffff', 'center');
    img.on('pointerup', function () {
      scene.tweens.add({
        targets: [img, lbl], scaleX: 0.94, scaleY: 0.94, duration: 70, yoyo: true,
        onComplete: onPress
      });
    });
    return { objs: [img, lbl], interactivos: [img] };
  }

  // -------------------------------------------------------------------
  // Panel de ajustes
  // -------------------------------------------------------------------

  /**
   * hooks: { onMusicVolume, onSfxVolume, onSpeed, onInvert, onTutorial, onToggle }
   */
  function createPanel(scene, hooks) {
    var cx = scene.sys.game.config.width / 2;
    var objs = [];
    var interactivos = [];

    function add(parte) {
      if (parte.objs) {
        objs = objs.concat(parte.objs);
        interactivos = interactivos.concat(parte.interactivos || []);
      } else {
        objs.push(parte);
      }
      return parte;
    }

    add(scene.add.image(cx, 238, 'ui_panel'));
    add(text(scene, cx, 88, 'AJUSTES', 22, '#ffffff', 'center'));

    var filas = [
      { clave: 'musicVolume', rotulo: 'Música', y: 120 },
      { clave: 'sfxVolume', rotulo: 'Efectos', y: 172 },
      { clave: 'speedIndex', rotulo: 'Velocidad', y: 224 }
    ];
    var valorTexto = {};
    var sliders = {};

    filas.forEach(function (fila) {
      add(text(scene, cx - 116, fila.y, fila.rotulo, 15, '#ffffff', 'left'));
      valorTexto[fila.clave] = add(text(scene, cx + 116, fila.y, '', 15, '#f4c329', 'right'));

      if (fila.clave === 'speedIndex') {
        sliders[fila.clave] = add(slider(scene, cx, fila.y + 24,
          values.speedIndex / (SPEEDS.length - 1), SPEEDS.length, function (t) {
            values.speedIndex = Math.round(t * (SPEEDS.length - 1));
            refrescarValores();
            save();
            if (hooks.onSpeed) { hooks.onSpeed(values.speedIndex); }
          }));
      } else {
        // Pasos del 5 %: así se pueden fijar el 0 % y el 100 % exactos con el
        // dedo, y el porcentaje mostrado siempre es un número redondo.
        sliders[fila.clave] = add(slider(scene, cx, fila.y + 24, values[fila.clave], VOL_STEPS, function (t) {
          values[fila.clave] = t;
          refrescarValores();
          save();
          if (fila.clave === 'musicVolume' && hooks.onMusicVolume) { hooks.onMusicVolume(t); }
          if (fila.clave === 'sfxVolume' && hooks.onSfxVolume) { hooks.onSfxVolume(t); }
        }));
      }
    });

    add(text(scene, cx - 116, 286, 'Invertir controles', 15, '#ffffff', 'left'));
    var interruptor = add(toggle(scene, cx + 92, 286, values.invertControls, function (v) {
      values.invertControls = v;
      save();
      if (hooks.onInvert) { hooks.onInvert(v); }
    }));

    add(button(scene, cx, 332, 'VER TUTORIAL', function () {
      if (hooks.onTutorial) { hooks.onTutorial(); }
    }));
    add(button(scene, cx, 382, 'CERRAR', function () { api.hide(); }));

    function refrescarValores() {
      valorTexto.musicVolume.setText(Math.round(values.musicVolume * 100) + '%');
      valorTexto.sfxVolume.setText(Math.round(values.sfxVolume * 100) + '%');
      valorTexto.speedIndex.setText(SPEED_LABELS[values.speedIndex]);
    }
    refrescarValores();

    objs.forEach(function (o) { o.setDepth(20); o.visible = false; o.alpha = 0; });
    interactivos.forEach(function (o) { o.disableInteractive(); });

    var api = {
      abierto: false,
      show: function () {
        api.abierto = true;
        objs.forEach(function (o) { o.visible = true; });
        sliders.musicVolume.set(values.musicVolume);
        sliders.sfxVolume.set(values.sfxVolume);
        sliders.speedIndex.set(values.speedIndex / (SPEEDS.length - 1));
        interruptor.set(values.invertControls);
        refrescarValores();
        interactivos.forEach(function (o) { o.setInteractive(); });
        scene.tweens.add({ targets: objs, alpha: 1, duration: 120 });
        if (hooks.onToggle) { hooks.onToggle(true); }
      },
      hide: function () {
        api.abierto = false;
        interactivos.forEach(function (o) { o.disableInteractive(); });
        scene.tweens.add({
          targets: objs, alpha: 0, duration: 120,
          onComplete: function () { objs.forEach(function (o) { o.visible = false; }); }
        });
        if (hooks.onToggle) { hooks.onToggle(false); }
      }
    };
    return api;
  }

  global.SelektorSettings = {
    values: values,
    SPEEDS: SPEEDS,
    SPEED_LABELS: SPEED_LABELS,
    load: load,
    save: save,
    speedFactor: function () { return SPEEDS[values.speedIndex]; },
    createPanel: createPanel
  };

})(window);
