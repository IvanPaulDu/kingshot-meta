/*
 * assets.js — Generación procedural de todos los recursos de SELEKTOR.
 *
 * El game.js original cargaba 22 imágenes PNG, 4 pistas de audio y una
 * fuente bitmap (imagen + JSON) desde la carpeta assets/. Aquí se crean
 * exactamente esas mismas claves de caché en tiempo de ejecución con
 * Canvas 2D y Web Audio, de modo que el juego arranca sin ningún fichero
 * externo. Las claves, tamaños y proporciones se eligieron para que la
 * lógica del juego (posiciones calculadas a partir de .width/.height,
 * radio del cuerpo Matter, colisiones y tweens) se comporte igual.
 */
(function (global) {
  'use strict';

  // Paleta idéntica a la del array `colors` de game.js
  var PAL = {
    red: '#ff2a36',
    green: '#6aca32',
    pink: '#ffa9bd',
    yellow: '#f4c329',
    cyan: '#5e97d6',
    magenta: '#b44ea4',
    aqua: '#36f1e6'
  };
  var PAL_LIST = [PAL.red, PAL.green, PAL.pink, PAL.yellow, PAL.cyan, PAL.magenta, PAL.aqua];

  var INK = '#23262d';
  var INK_SOFT = 'rgba(35,38,45,0.75)';
  var FONT_STACK = '"Arial Black","Arial Bold",Arial,Helvetica,sans-serif';

  // ---------------------------------------------------------------------
  // Utilidades de dibujo
  // ---------------------------------------------------------------------

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  /** Crea (una sola vez) una textura de canvas registrada en el gestor de texturas. */
  function tex(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) { return; }
    var canvas = makeCanvas(w, h);
    var ctx = canvas.getContext('2d');
    draw(ctx, w, h);
    scene.textures.addCanvas(key, canvas);
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  function centeredText(ctx, text, x, y, font, fill, strokeColor, strokeWidth) {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (strokeColor && strokeWidth) {
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = strokeColor;
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /** Resplandor radial suave, usado para destellos y partículas. */
  function radialGlow(ctx, x, y, r, inner, outer) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner);
    g.addColorStop(0.45, outer.replace(/[\d.]+\)$/, '0.35)'));
    g.addColorStop(1, outer.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------------------------------------------------------------------
  // Texturas
  // ---------------------------------------------------------------------

  function buildTextures(scene) {

    // --- pared: bloque blanco de 24px que el juego estira a toda la altura
    //     y tiñe con setTint(). Debe ser prácticamente blanco puro para que
    //     el tinte reproduzca el color exacto de la paleta.
    var wallDraw = function (ctx, w, h) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      var g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.16)');
      g.addColorStop(0.28, 'rgba(0,0,0,0)');
      g.addColorStop(0.72, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.16)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(w * 0.32, 0, w * 0.14, h);
    };
    tex(scene, 'pared_derecha', 24, 64, wallDraw);
    tex(scene, 'pared_izquierda', 24, 64, wallDraw);

    // --- bola: blanca con sombreado suave. setCircle() usa width/2 = 14
    //     como radio del cuerpo Matter.
    tex(scene, 'bola', 28, 28, function (ctx, w, h) {
      var r = w / 2;
      var g = ctx.createRadialGradient(w * 0.36, h * 0.32, r * 0.1, r, r, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.55, '#f2f2f2');
      g.addColorStop(1, '#c7c7c7');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(r, r, r - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,120,120,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.ellipse(w * 0.36, h * 0.28, r * 0.28, r * 0.2, -Math.PI / 5, 0, Math.PI * 2);
      ctx.fill();
    });

    tex(scene, 'bola_sombra', 28, 28, function (ctx, w, h) {
      var r = w / 2;
      var g = ctx.createRadialGradient(r, r, r * 0.2, r, r, r);
      g.addColorStop(0, 'rgba(0,0,0,0.8)');
      g.addColorStop(0.75, 'rgba(0,0,0,0.7)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // --- pala: el cuerpo Matter es un rectángulo del tamaño de la textura
    //     (92x16) que rota a 45° / 125° para desviar la bola.
    tex(scene, 'pala', 92, 16, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.55, '#f0f2f5');
      g.addColorStop(1, '#cfd5dd');
      roundRect(ctx, 1.5, 1.5, w - 3, h - 3, 7);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      roundRect(ctx, 8, 4.5, w - 16, 2.5, 1.25);
      ctx.fill();
    });

    tex(scene, 'pala_sombra', 92, 16, function (ctx, w, h) {
      roundRect(ctx, 0, 0, w, h, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fill();
    });

    // --- flechas de control (esquinas inferiores)
    var arrowDraw = function (dir) {
      return function (ctx, w, h) {
        var cx = w / 2, cy = h / 2, r = w / 2 - 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = INK;
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(dir, 1);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-6, -17);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-16, -6);
        ctx.lineTo(-16, 6);
        ctx.lineTo(-6, 6);
        ctx.lineTo(-6, 17);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };
    };
    tex(scene, 'flecha_derecha', 74, 74, arrowDraw(1));
    tex(scene, 'flecha_izquierda', 74, 74, arrowDraw(-1));

    // --- partícula de estrella para el choque final
    tex(scene, 'particula_estrella', 24, 24, function (ctx, w, h) {
      var cx = w / 2, cy = h / 2;
      radialGlow(ctx, cx, cy, cx, 'rgba(255,255,255,0.9)', 'rgba(255,220,120,0.9)');
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.quadraticCurveTo(cx + 2, cy - 2, w, cy);
      ctx.quadraticCurveTo(cx + 2, cy + 2, cx, h);
      ctx.quadraticCurveTo(cx - 2, cy + 2, 0, cy);
      ctx.quadraticCurveTo(cx - 2, cy - 2, cx, 0);
      ctx.closePath();
      ctx.fill();
    });

    // --- botón START
    tex(scene, 'start_button', 200, 64, function (ctx, w, h) {
      roundRect(ctx, 3, 3, w - 6, h - 6, (h - 6) / 2);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      var g = ctx.createLinearGradient(0, 6, 0, h / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      roundRect(ctx, 8, 8, w - 16, h / 2 - 8, 16);
      ctx.fillStyle = g;
      ctx.fill();
      centeredText(ctx, 'START', w / 2, h / 2 + 1, 'bold 30px ' + FONT_STACK, '#ffffff');
    });

    // --- portada / logotipo
    tex(scene, 'titulo', 300, 160, function (ctx, w, h) {
      var chipW = 30, chipH = 30, gap = 6;
      var totalW = PAL_LIST.length * chipW + (PAL_LIST.length - 1) * gap;
      var x0 = (w - totalW) / 2;
      for (var i = 0; i < PAL_LIST.length; i++) {
        roundRect(ctx, x0 + i * (chipW + gap), 16, chipW, chipH, 8);
        ctx.fillStyle = PAL_LIST[i];
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      centeredText(ctx, 'SELEKTOR', w / 2, 88, 'bold 46px ' + FONT_STACK, INK, '#ffffff', 10);
      centeredText(ctx, 'REBOTA · ACIERTA · REPITE', w / 2, 128,
        'bold 14px ' + FONT_STACK, INK, 'rgba(255,255,255,0.9)', 6);
    });

    // --- destello: se tiñe del color de la bola al puntuar
    tex(scene, 'destello', 160, 40, function (ctx, w, h) {
      var cx = w / 2, cy = h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, h / w);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, cx);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, cx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      roundRect(ctx, 10, cy - 1.5, w - 20, 3, 1.5);
      ctx.fill();
    });

    // --- copa + barra de mejor puntuación del menú
    tex(scene, 'copa', 140, 48, function (ctx, w, h) {
      roundRect(ctx, 0, 0, w, h, h / 2);
      ctx.fillStyle = 'rgba(35,38,45,0.88)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();

      // copa dorada a la izquierda (el número se dibuja a la derecha)
      ctx.save();
      ctx.translate(30, 24);
      ctx.fillStyle = PAL.yellow;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-9, -13);
      ctx.lineTo(9, -13);
      ctx.lineTo(7, 0);
      ctx.quadraticCurveTo(0, 8, -7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-12, -8, 5, Math.PI * 0.55, Math.PI * 1.65, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(12, -8, 5, Math.PI * 1.35, Math.PI * 0.45, true);
      ctx.stroke();
      ctx.fillRect(-2, 6, 4, 5);
      roundRect(ctx, -8, 11, 16, 5, 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // --- pantalla de cierre (game over)
    tex(scene, 'cierre_final', 320, 480, function (ctx, w, h) {
      var g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, h * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0.78)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      var pw = 284, ph = 132, px = (w - pw) / 2, py = 300;
      roundRect(ctx, px, py, pw, ph, 22);
      ctx.fillStyle = 'rgba(20,23,29,0.94)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      centeredText(ctx, 'GAME OVER', w / 2, py + 48, 'bold 32px ' + FONT_STACK, '#ffffff');
      var barW = 28, bx = w / 2 - (PAL_LIST.length * (barW + 4) - 4) / 2;
      for (var i = 0; i < PAL_LIST.length; i++) {
        roundRect(ctx, bx + i * (barW + 4), py + 74, barW, 8, 4);
        ctx.fillStyle = PAL_LIST[i];
        ctx.fill();
      }
      centeredText(ctx, 'COLOR EQUIVOCADO', w / 2, py + 106,
        'bold 14px ' + FONT_STACK, 'rgba(255,255,255,0.72)');
    });

    // --- indicador "toca aquí" del tutorial
    tex(scene, 'smash_button', 100, 100, function (ctx, w, h) {
      var cx = w / 2, cy = h / 2;
      radialGlow(ctx, cx, cy, cx, 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.55)');
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
    });

    // --- velo del tutorial: oscurece el lado izquierdo para destacar el
    //     derecho. El juego usa setFlipX(true) para la versión izquierda,
    //     así que no puede llevar texto.
    tex(scene, 'tutorial_back', 320, 480, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.9)');
      g.addColorStop(0.45, 'rgba(0,0,0,0.62)');
      g.addColorStop(1, 'rgba(0,0,0,0.08)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });

    // --- flecha de giro que se superpone a la pala. El arco es más ancho
    //     que la propia pala (92px) para que la envuelva en vez de taparla.
    tex(scene, 'flecha_tuto', 160, 160, function (ctx, w, h) {
      var cx = w / 2, cy = h / 2, r = 62;
      ctx.lineCap = 'round';
      ctx.lineWidth = 16;
      ctx.strokeStyle = 'rgba(35,38,45,0.8)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 1.14, Math.PI * 1.86);
      ctx.stroke();
      ctx.lineWidth = 9;
      ctx.strokeStyle = 'rgba(255,255,255,0.96)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 1.14, Math.PI * 1.86);
      ctx.stroke();

      // punta de flecha en el extremo derecho del arco
      var a = Math.PI * 1.86;
      var ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(13, 9);
      ctx.lineTo(-13, 9);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(35,38,45,0.85)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    });

    // --- iconos de sonido
    var speaker = function (on) {
      return function (ctx, w, h) {
        var cx = w / 2, cy = h / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = INK;
        ctx.stroke();

        ctx.save();
        ctx.translate(cx - 3, cy);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(-9, -4);
        ctx.lineTo(-3, -4);
        ctx.lineTo(3, -11);
        ctx.lineTo(3, 11);
        ctx.lineTo(-3, 4);
        ctx.lineTo(-9, 4);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = INK;
        ctx.lineCap = 'round';
        if (on) {
          ctx.beginPath();
          ctx.arc(5, 0, 6, -Math.PI / 3, Math.PI / 3);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(5, 0, 11, -Math.PI / 3, Math.PI / 3);
          ctx.stroke();
        } else {
          ctx.strokeStyle = PAL.red;
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(7, -6); ctx.lineTo(16, 6);
          ctx.moveTo(16, -6); ctx.lineTo(7, 6);
          ctx.stroke();
        }
        ctx.restore();
      };
    };
    tex(scene, 'bocina_on', 48, 48, speaker(true));
    tex(scene, 'bocina_off', 48, 48, speaker(false));

    // --- botón de información
    tex(scene, 'info_button', 48, 48, function (ctx, w, h) {
      var cx = w / 2, cy = h / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      centeredText(ctx, 'i', cx, cy + 1, 'bold 26px Georgia,serif', INK);
    });

    // --- panel "acerca de"
    tex(scene, 'info_about', 280, 212, function (ctx, w, h) {
      roundRect(ctx, 3, 3, w - 6, h - 6, 20);
      ctx.fillStyle = 'rgba(20,23,29,0.96)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      centeredText(ctx, 'SELEKTOR', w / 2, 42, 'bold 26px ' + FONT_STACK, '#ffffff');
      centeredText(ctx, 'Rebota la bola hacia la pared', w / 2, 72, '13px ' + FONT_STACK, 'rgba(255,255,255,0.88)');
      centeredText(ctx, 'que tenga su mismo color.', w / 2, 91, '13px ' + FONT_STACK, 'rgba(255,255,255,0.88)');
      centeredText(ctx, 'Gráficos y música generados por código', w / 2, 112, '11px ' + FONT_STACK, 'rgba(255,255,255,0.6)');
      ctx.save();
      ctx.font = 'bold 13px ' + FONT_STACK;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('SÍGUENOS', 26, 136);
      ctx.restore();
      centeredText(ctx, 'coreanodecalle', w / 2, 186, '12px ' + FONT_STACK, 'rgba(255,255,255,0.45)');
    });

    tex(scene, 'fb_button', 33, 33, function (ctx, w, h) {
      roundRect(ctx, 0, 0, w, h, 8);
      ctx.fillStyle = '#1877f2';
      ctx.fill();
      centeredText(ctx, 'f', w / 2, h / 2 + 1, 'bold 24px Georgia,serif', '#ffffff');
    });

    tex(scene, 'insta_button', 33, 33, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, h, w, 0);
      g.addColorStop(0, '#f9ce34');
      g.addColorStop(0.5, '#ee2a7b');
      g.addColorStop(1, '#6228d7');
      roundRect(ctx, 0, 0, w, h, 8);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.4;
      roundRect(ctx, 7, 7, w - 14, h - 14, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 4.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w - 10.5, 10.5, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    });
  }

  // ---------------------------------------------------------------------
  // Fuente bitmap (RetroFont) para el marcador
  // ---------------------------------------------------------------------

  var FONT_CHARS = '0123456789';
  var FONT_CELL_W = 34;
  var FONT_CELL_H = 48;

  function buildFont(scene) {
    tex(scene, 'score_font', FONT_CELL_W * FONT_CHARS.length, FONT_CELL_H, function (ctx, w, h) {
      for (var i = 0; i < FONT_CHARS.length; i++) {
        var cx = i * FONT_CELL_W + FONT_CELL_W / 2;
        centeredText(ctx, FONT_CHARS[i], cx, h / 2 + 1,
          'bold 42px ' + FONT_STACK, '#ffffff', INK, 8);
      }
    });

    // Mismo formato que el font.json original que consumía RetroFont.Parse
    scene.cache.json.remove('score_font_json');
    scene.cache.json.add('score_font_json', {
      image: 'score_font',
      width: FONT_CELL_W,
      height: FONT_CELL_H,
      chars: FONT_CHARS,
      charsPerRow: FONT_CHARS.length,
      'offset.x': 0,
      'offset.y': 0,
      'spacing.x': 0,
      'spacing.y': 0,
      lineSpacing: 0,
      offset: { x: 0, y: 0 },
      spacing: { x: 0, y: 0 }
    });
  }

  // ---------------------------------------------------------------------
  // Audio procedural
  // ---------------------------------------------------------------------

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function noise() { return Math.random() * 2 - 1; }

  /** Onda cuadrada con ciclo de trabajo configurable. */
  function square(phase, duty) {
    return (phase % 1) < (duty === undefined ? 0.5 : duty) ? 1 : -1;
  }

  function saw(phase) { return 2 * (phase % 1) - 1; }

  /**
   * Mezcla una nota en el búfer.
   * opts: { wave, duty, attack, decay, gain, sweepTo, filter }
   */
  function addNote(data, rate, start, dur, freq, opts) {
    opts = opts || {};
    var wave = opts.wave || 'square';
    var duty = opts.duty === undefined ? 0.5 : opts.duty;
    var attack = opts.attack === undefined ? 0.004 : opts.attack;
    var decay = opts.decay === undefined ? 8 : opts.decay;
    var gain = opts.gain === undefined ? 0.2 : opts.gain;
    var i0 = Math.floor(start * rate);
    var n = Math.floor(dur * rate);
    var phase = 0;
    var lp = 0;
    var lpK = opts.filter === undefined ? 1 : opts.filter;
    for (var i = 0; i < n; i++) {
      var idx = i0 + i;
      if (idx < 0 || idx >= data.length) { continue; }
      var t = i / rate;
      var f = freq;
      if (opts.sweepTo !== undefined) {
        f = freq + (opts.sweepTo - freq) * Math.min(1, t / dur);
      }
      phase += f / rate;
      var s;
      if (wave === 'sine') { s = Math.sin(phase * Math.PI * 2); }
      else if (wave === 'saw') { s = saw(phase); }
      else if (wave === 'noise') { s = noise(); }
      else { s = square(phase, duty); }
      if (lpK < 1) { lp += (s - lp) * lpK; s = lp; }
      var env = Math.exp(-t * decay);
      if (t < attack) { env *= t / attack; }
      data[idx] += s * env * gain;
    }
  }

  function softClip(data) {
    for (var i = 0; i < data.length; i++) {
      data[i] = Math.tanh(data[i] * 1.15) / 1.15;
    }
  }

  // -- Definición de cada efecto -----------------------------------------

  function fxBounce(data, rate) {   // golpe de la bola contra la pala
    addNote(data, rate, 0, 0.11, 210, { wave: 'sine', sweepTo: 70, decay: 34, gain: 0.62 });
    addNote(data, rate, 0, 0.02, 900, { wave: 'noise', decay: 120, gain: 0.2 });
    softClip(data);
  }

  function fxDrop(data, rate) {    // acierto de color
    addNote(data, rate, 0, 0.07, 880, { wave: 'square', duty: 0.32, decay: 16, gain: 0.32, filter: 0.55 });
    addNote(data, rate, 0.055, 0.13, 1318.5, { wave: 'square', duty: 0.32, decay: 14, gain: 0.32, filter: 0.55 });
    addNote(data, rate, 0.055, 0.13, 1760, { wave: 'sine', decay: 15, gain: 0.16 });
    softClip(data);
  }

  function fxCrash(data, rate) {   // fallo: fin de la partida
    addNote(data, rate, 0, 0.55, 3000, { wave: 'noise', decay: 8, gain: 0.5, filter: 0.32 });
    addNote(data, rate, 0, 0.5, 190, { wave: 'sine', sweepTo: 42, decay: 6, gain: 0.6 });
    addNote(data, rate, 0, 0.28, 96, { wave: 'square', duty: 0.5, decay: 11, gain: 0.28, filter: 0.2 });
    softClip(data);
  }

  // Música de fondo: 4 compases a 120 BPM = 8 s de bucle continuo.
  var BG_BPM = 120;
  var BG_BARS = 4;
  var BG_STEP = (60 / BG_BPM) / 4;          // semicorchea
  var BG_LEN = BG_BARS * 16 * BG_STEP;      // 8 s

  var CHORDS = [
    { bass: 45, notes: [57, 60, 64] },   // Am
    { bass: 41, notes: [53, 57, 60] },   // F
    { bass: 48, notes: [60, 64, 67] },   // C
    { bass: 43, notes: [55, 59, 62] }    // G
  ];

  function fxMusic(data, rate) {
    for (var bar = 0; bar < BG_BARS; bar++) {
      var ch = CHORDS[bar % CHORDS.length];
      for (var s = 0; s < 16; s++) {
        var t = (bar * 16 + s) * BG_STEP;

        // Bajo en corcheas, con octava alta en los contratiempos finales
        if (s % 2 === 0) {
          var bn = (s === 6 || s === 14) ? ch.bass + 12 : ch.bass;
          addNote(data, rate, t, BG_STEP * 1.7, midiToFreq(bn),
            { wave: 'square', duty: 0.5, decay: 7, gain: 0.3, filter: 0.35 });
        }

        // Arpegio en semicorcheas
        var an = ch.notes[s % ch.notes.length] + (s >= 8 ? 12 : 0);
        addNote(data, rate, t, BG_STEP * 1.3, midiToFreq(an),
          { wave: 'square', duty: 0.25, decay: 13, gain: 0.115, filter: 0.6 });

        // Bombo en 1 y 3
        if (s === 0 || s === 8) {
          addNote(data, rate, t, 0.16, 130, { wave: 'sine', sweepTo: 45, decay: 22, gain: 0.5 });
        }
        // Caja en 2 y 4
        if (s === 4 || s === 12) {
          addNote(data, rate, t, 0.13, 2200, { wave: 'noise', decay: 26, gain: 0.2, filter: 0.5 });
          addNote(data, rate, t, 0.09, 180, { wave: 'sine', decay: 30, gain: 0.18 });
        }
        // Charles en contratiempos
        if (s % 4 === 2) {
          addNote(data, rate, t, 0.05, 6000, { wave: 'noise', decay: 65, gain: 0.09 });
        }
      }

      // Colchón sostenido, muy suave
      for (var k = 0; k < ch.notes.length; k++) {
        addNote(data, rate, bar * 16 * BG_STEP, 16 * BG_STEP, midiToFreq(ch.notes[k] - 12),
          { wave: 'sine', attack: 0.08, decay: 1.1, gain: 0.075 });
      }
    }
    softClip(data);
  }

  // -- Registro en la caché de audio de Phaser ---------------------------

  function encodeWav(data, rate) {
    var n = data.length;
    var buf = new ArrayBuffer(44 + n * 2);
    var v = new DataView(buf);
    var str = function (off, s) {
      for (var i = 0; i < s.length; i++) { v.setUint8(off + i, s.charCodeAt(i)); }
    };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) {
      var s = Math.max(-1, Math.min(1, data[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    var bytes = new Uint8Array(buf);
    var bin = '';
    for (var j = 0; j < bytes.length; j += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(j, j + 0x8000));
    }
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  function buildSound(scene, key, seconds, fill) {
    if (scene.cache.audio.exists(key)) { return; }
    var ctx = scene.sound && scene.sound.context;
    var rate = (ctx && ctx.sampleRate) || 44100;
    var len = Math.max(1, Math.floor(seconds * rate));
    var data = new Float32Array(len);
    fill(data, rate);

    if (ctx && ctx.createBuffer) {
      // Web Audio: se inyecta el AudioBuffer directamente en la caché,
      // que es exactamente lo que espera Phaser.Sound.WebAudioSound.
      var buffer = ctx.createBuffer(1, len, rate);
      buffer.getChannelData(0).set(data);
      scene.cache.audio.add(key, buffer);
    } else {
      // Reserva para el gestor HTML5: una lista de etiquetas <audio>.
      var url = encodeWav(data, rate);
      var tags = [];
      for (var i = 0; i < 4; i++) {
        var a = new Audio();
        a.dataset.key = key;
        a.src = url;
        a.preload = 'auto';
        a.load();
        tags.push(a);
      }
      scene.cache.audio.add(key, tags);
    }
  }

  function buildAudio(scene) {
    buildSound(scene, 'drop', 0.22, fxDrop);
    buildSound(scene, 'bounce_sound', 0.14, fxBounce);
    buildSound(scene, 'crash_sound', 0.6, fxCrash);
    buildSound(scene, 'bg_music', BG_LEN, fxMusic);
  }

  // ---------------------------------------------------------------------

  global.SelektorAssets = {
    palette: PAL_LIST,
    generate: function (scene) {
      buildTextures(scene);
      buildFont(scene);
      buildAudio(scene);
    }
  };

})(window);
