/*
 * artwork.js — Toda la gráfica del juego, pintada con Canvas 2D al arrancar.
 *
 * No hay ficheros de imagen: cada recurso es una receta que declara su tamaño
 * y su función de pintado. Las recetas cuyo tamaño depende del lienzo lo
 * reciben como argumento, y una textura ya existente se rehace si el lienzo
 * cambió de proporción.
 */
(function (global) {
  'use strict';

  var INK = global.Chroma.INK;
  var TYPEFACE = '"Arial Black","Arial Bold",Arial,Helvetica,sans-serif';

  // ---------------------------------------------------------------- Pen ---

  /** Envoltorio del contexto 2D con las primitivas que usa el juego. */
  function Pen(ctx) { this.ctx = ctx; }

  Pen.prototype.roundedBox = function (x, y, w, h, radius) {
    var ctx = this.ctx;
    var r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    return this;
  };

  Pen.prototype.disc = function (x, y, r) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    return this;
  };

  Pen.prototype.fill = function (style) {
    this.ctx.fillStyle = style;
    this.ctx.fill();
    return this;
  };

  Pen.prototype.stroke = function (style, width) {
    this.ctx.lineWidth = width;
    this.ctx.strokeStyle = style;
    this.ctx.stroke();
    return this;
  };

  /** Texto centrado, opcionalmente con contorno pintado por debajo. */
  Pen.prototype.label = function (text, x, y, opts) {
    var ctx = this.ctx;
    ctx.save();
    ctx.font = (opts.weight || 'bold') + ' ' + opts.size + 'px ' + (opts.face || TYPEFACE);
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    if (opts.outline) {
      ctx.lineWidth = opts.outlineWidth || 8;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = opts.outline;
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = opts.color;
    ctx.fillText(text, x, y);
    ctx.restore();
    return this;
  };

  /** Halo radial que se apaga hacia fuera. */
  Pen.prototype.halo = function (x, y, r, core) {
    var g = this.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,' + core + ')');
    g.addColorStop(0.4, 'rgba(255,255,255,' + (core * 0.32).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    return this.disc(x, y, r).fill(g);
  };

  // ------------------------------------------------------------ Recetas ---

  var FIXED = {};        // tamaño constante
  var ELASTIC = {};      // tamaño derivado del lienzo

  function recipe(bag, key, w, h, paint) { bag[key] = { w: w, h: h, paint: paint }; }

  // Columna lateral: blanca pura, porque el juego la estira a toda la altura y
  // le aplica el tinte de su color. Solo lleva sombreado en los cantos.
  recipe(FIXED, 'column', 24, 64, function (pen, w, h) {
    var ctx = pen.ctx;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    var edge = ctx.createLinearGradient(0, 0, w, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0.18)');
    edge.addColorStop(0.3, 'rgba(0,0,0,0)');
    edge.addColorStop(0.7, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);
  });

  // Esfera. Su radio físico sale de la mitad del ancho de esta textura.
  recipe(FIXED, 'orb', 28, 28, function (pen, w, h) {
    var r = w / 2;
    var body = pen.ctx.createRadialGradient(w * 0.36, h * 0.3, r * 0.1, r, r, r);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.55, '#f3f3f3');
    body.addColorStop(1, '#c4c4c4');
    pen.disc(r, r, r - 1).fill(body).stroke('rgba(120,120,120,0.5)', 1.5);
    pen.ctx.save();
    pen.ctx.translate(w * 0.36, h * 0.28);
    pen.ctx.rotate(-Math.PI / 5);
    pen.ctx.scale(1, 0.7);
    pen.disc(0, 0, r * 0.28).fill('rgba(255,255,255,0.95)');
    pen.ctx.restore();
  });

  recipe(FIXED, 'orbShade', 28, 28, function (pen, w, h) {
    var r = w / 2;
    var g = pen.ctx.createRadialGradient(r, r, r * 0.2, r, r, r);
    g.addColorStop(0, 'rgba(0,0,0,0.78)');
    g.addColorStop(0.75, 'rgba(0,0,0,0.68)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    pen.disc(r, r, r).fill(g);
  });

  // Paleta deflectora: su cuerpo físico es un rectángulo de este tamaño.
  recipe(FIXED, 'blade', 92, 16, function (pen, w, h) {
    var face = pen.ctx.createLinearGradient(0, 0, 0, h);
    face.addColorStop(0, '#ffffff');
    face.addColorStop(0.55, '#eff1f4');
    face.addColorStop(1, '#ccd2da');
    pen.roundedBox(1.5, 1.5, w - 3, h - 3, 7).fill(face).stroke(INK, 3);
    pen.roundedBox(8, 4.5, w - 16, 2.5, 1.25).fill('rgba(255,255,255,0.9)');
  });

  recipe(FIXED, 'bladeShade', 92, 16, function (pen, w, h) {
    pen.roundedBox(0, 0, w, h, 8).fill('rgba(0,0,0,0.78)');
  });

  // Mandos de giro. `facing` 1 apunta a la derecha, -1 a la izquierda.
  function steerPainter(facing) {
    return function (pen, w, h) {
      var c = w / 2;
      pen.disc(c, c, c - 4).fill('rgba(255,255,255,0.94)').stroke(INK, 4);
      var ctx = pen.ctx;
      ctx.save();
      ctx.translate(c, c);
      ctx.scale(facing, 1);
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-6, -17);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-16, -6);
      ctx.lineTo(-16, 6);
      ctx.lineTo(-6, 6);
      ctx.lineTo(-6, 17);
      ctx.closePath();
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.restore();
    };
  }
  recipe(FIXED, 'steerRight', 74, 74, steerPainter(1));
  recipe(FIXED, 'steerLeft', 74, 74, steerPainter(-1));

  // Esquirla del estallido final.
  recipe(FIXED, 'shard', 24, 24, function (pen, w, h) {
    var c = w / 2;
    pen.halo(c, c, c, 0.85);
    var ctx = pen.ctx;
    ctx.beginPath();
    ctx.moveTo(c, 0);
    ctx.quadraticCurveTo(c + 2, c - 2, w, c);
    ctx.quadraticCurveTo(c + 2, c + 2, c, h);
    ctx.quadraticCurveTo(c - 2, c + 2, 0, c);
    ctx.quadraticCurveTo(c - 2, c - 2, c, 0);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });

  // Chispazo del acierto. Compacto a propósito: el juego lo agranda hasta más
  // del doble y lo planta sobre el canto de la columna.
  recipe(FIXED, 'sparkle', 64, 44, function (pen, w, h) {
    var cx = w / 2, cy = h / 2;
    pen.halo(cx, cy, cy, 0.9);
    var ctx = pen.ctx;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.quadraticCurveTo(cx - 4, cy - 3, cx, 0);
    ctx.quadraticCurveTo(cx + 4, cy - 3, w, cy);
    ctx.quadraticCurveTo(cx + 4, cy + 3, cx, h);
    ctx.quadraticCurveTo(cx - 4, cy + 3, 0, cy);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    pen.disc(cx, cy, 5).fill('#ffffff');
  });

  recipe(FIXED, 'playPill', 200, 64, function (pen, w, h) {
    pen.roundedBox(3, 3, w - 6, h - 6, (h - 6) / 2).fill(INK).stroke('#ffffff', 4);
    var sheen = pen.ctx.createLinearGradient(0, 6, 0, h / 2);
    sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    pen.roundedBox(8, 8, w - 16, h / 2 - 8, 16).fill(sheen);
    pen.label('JUGAR', w / 2, h / 2 + 1, { size: 30, color: '#ffffff' });
  });

  recipe(FIXED, 'wordmark', 300, 160, function (pen, w, h) {
    var swatches = global.Chroma.SWATCHES;
    var chip = 30, gap = 6;
    var span = swatches.length * chip + (swatches.length - 1) * gap;
    var x = (w - span) / 2;
    for (var i = 0; i < swatches.length; i++) {
      pen.roundedBox(x + i * (chip + gap), 12, chip, chip, 8)
        .fill(swatches[i].css).stroke(INK, 3);
    }
    pen.label('VAIVÉN', w / 2, 96,
      { size: 50, color: INK, outline: '#ffffff', outlineWidth: 10 });
    pen.label('DEVUELVE CADA COLOR A SU LADO', w / 2, 134,
      { size: 13, color: INK, outline: 'rgba(255,255,255,0.92)', outlineWidth: 6 });
  });

  // Barra del récord: la cifra se dibuja a la derecha del emblema.
  recipe(FIXED, 'recordBar', 140, 48, function (pen, w, h) {
    pen.roundedBox(0, 0, w, h, h / 2)
      .fill('rgba(29,32,39,0.88)').stroke('rgba(255,255,255,0.9)', 3);
    var ctx = pen.ctx;
    ctx.save();
    ctx.translate(30, 24);
    // Laurel abierto alrededor de una estrella.
    ctx.strokeStyle = global.Chroma.css(1);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 1, 13, Math.PI * 0.62, Math.PI * 1.38);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 1, 13, Math.PI * 1.62, Math.PI * 0.38);
    ctx.stroke();
    ctx.fillStyle = global.Chroma.css(1);
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 ? 3.6 : 8.4;
      var a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r + 1);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  recipe(FIXED, 'tapRing', 100, 100, function (pen, w, h) {
    var c = w / 2;
    pen.halo(c, c, c, 0.5);
    pen.disc(c, c, 42).stroke('#ffffff', 6);
    pen.disc(c, c, 30).stroke('rgba(255,255,255,0.7)', 3);
    pen.disc(c, c, 14).fill('#ffffff');
  });

  // Flecha de giro. El arco es más ancho que la paleta para envolverla.
  recipe(FIXED, 'spinArrow', 160, 160, function (pen, w, h) {
    var c = w / 2, r = 62, from = Math.PI * 1.14, to = Math.PI * 1.86;
    var ctx = pen.ctx;
    ctx.lineCap = 'round';
    [[16, 'rgba(29,32,39,0.8)'], [9, 'rgba(255,255,255,0.96)']].forEach(function (pass) {
      ctx.lineWidth = pass[0];
      ctx.strokeStyle = pass[1];
      ctx.beginPath();
      ctx.arc(c, c, r, from, to);
      ctx.stroke();
    });
    ctx.save();
    ctx.translate(c + Math.cos(to) * r, c + Math.sin(to) * r);
    ctx.rotate(to + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(13, 9);
    ctx.lineTo(-13, 9);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(29,32,39,0.8)';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  });

  function speakerPainter(audible) {
    return function (pen, w, h) {
      var c = w / 2;
      pen.disc(c, c, c - 2).fill('rgba(255,255,255,0.92)').stroke(INK, 3);
      var ctx = pen.ctx;
      ctx.save();
      ctx.translate(c - 3, c);
      ctx.beginPath();
      ctx.moveTo(-9, -4);
      ctx.lineTo(-3, -4);
      ctx.lineTo(3, -11);
      ctx.lineTo(3, 11);
      ctx.lineTo(-3, 4);
      ctx.lineTo(-9, 4);
      ctx.closePath();
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.lineCap = 'round';
      if (audible) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.6;
        [6, 11].forEach(function (radius) {
          ctx.beginPath();
          ctx.arc(5, 0, radius, -Math.PI / 3, Math.PI / 3);
          ctx.stroke();
        });
      } else {
        ctx.strokeStyle = global.Chroma.css(0);
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(7, -6); ctx.lineTo(16, 6);
        ctx.moveTo(16, -6); ctx.lineTo(7, 6);
        ctx.stroke();
      }
      ctx.restore();
    };
  }
  recipe(FIXED, 'soundOn', 48, 48, speakerPainter(true));
  recipe(FIXED, 'soundOff', 48, 48, speakerPainter(false));

  recipe(FIXED, 'gear', 48, 48, function (pen, w, h) {
    var c = w / 2;
    pen.disc(c, c, c - 2).fill('rgba(255,255,255,0.92)').stroke(INK, 3);
    var ctx = pen.ctx;
    ctx.save();
    ctx.translate(c, c);
    ctx.fillStyle = INK;
    for (var i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 * i) / 8);
      pen.roundedBox(-2.6, -15, 5.2, 6, 1.5);
      ctx.fill();
      ctx.restore();
    }
    pen.disc(0, 0, 9.5).fill(INK);
    ctx.globalCompositeOperation = 'destination-out';
    pen.disc(0, 0, 4.2).fill('#000000');
    ctx.restore();
  });

  recipe(FIXED, 'servePrompt', 240, 52, function (pen, w, h) {
    pen.roundedBox(2.5, 2.5, w - 5, h - 5, (h - 5) / 2)
      .fill('rgba(20,23,29,0.88)').stroke('#ffffff', 3);
    pen.label('TOCA PARA EMPEZAR', w / 2, h / 2 + 1, { size: 17, color: '#ffffff' });
  });

  // --- Piezas del panel de opciones ---

  recipe(FIXED, 'panel', 296, 352, function (pen, w, h) {
    pen.roundedBox(3, 3, w - 6, h - 6, 22)
      .fill('rgba(20,23,29,0.97)').stroke('#ffffff', 4);
  });

  recipe(FIXED, 'rail', 232, 12, function (pen, w, h) {
    pen.roundedBox(0, 0, w, h, h / 2).fill('#ffffff');
  });

  recipe(FIXED, 'grip', 28, 28, function (pen, w, h) {
    pen.disc(w / 2, w / 2, w / 2 - 3).fill('#ffffff').stroke(INK, 3.5);
  });

  recipe(FIXED, 'pill', 200, 42, function (pen, w, h) {
    pen.roundedBox(2.5, 2.5, w - 5, h - 5, (h - 5) / 2)
      .fill('rgba(255,255,255,0.1)').stroke('#ffffff', 3);
  });

  function switchPainter(on) {
    return function (pen, w, h) {
      pen.roundedBox(1.5, 1.5, w - 3, h - 3, (h - 3) / 2)
        .fill(on ? global.Chroma.css(2) : 'rgba(255,255,255,0.16)')
        .stroke(on ? '#ffffff' : 'rgba(255,255,255,0.55)', 3);
    };
  }
  recipe(FIXED, 'switchOn', 62, 32, switchPainter(true));
  recipe(FIXED, 'switchOff', 62, 32, switchPainter(false));

  recipe(FIXED, 'switchGrip', 24, 24, function (pen, w, h) {
    pen.disc(w / 2, w / 2, w / 2 - 1.5).fill('#ffffff').stroke('rgba(29,32,39,0.5)', 2);
  });

  // --- Piezas a lienzo completo ---

  recipe(ELASTIC, 'endCard', null, null, function (pen, w, h) {
    var wash = pen.ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, h * 0.75);
    wash.addColorStop(0, 'rgba(0,0,0,0.35)');
    wash.addColorStop(1, 'rgba(0,0,0,0.78)');
    pen.ctx.fillStyle = wash;
    pen.ctx.fillRect(0, 0, w, h);

    var boxW = Math.min(284, w - 36), boxH = 132;
    var boxX = (w - boxW) / 2, boxY = Math.round(h * 0.625);
    pen.roundedBox(boxX, boxY, boxW, boxH, 22)
      .fill('rgba(20,23,29,0.94)').stroke('#ffffff', 4);
    pen.label('SE ACABÓ', w / 2, boxY + 48, { size: 32, color: '#ffffff' });
    var swatches = global.Chroma.SWATCHES;
    var barW = 28;
    var startX = w / 2 - (swatches.length * (barW + 4) - 4) / 2;
    for (var i = 0; i < swatches.length; i++) {
      pen.roundedBox(startX + i * (barW + 4), boxY + 74, barW, 8, 4).fill(swatches[i].css);
    }
    pen.label('COLOR EQUIVOCADO', w / 2, boxY + 106,
      { size: 14, color: 'rgba(255,255,255,0.72)' });
  });

  // Velo del aprendizaje guiado: apaga un lado para destacar el otro. Sin
  // texto, porque el juego lo reutiliza reflejado para el lado contrario.
  recipe(ELASTIC, 'veil', null, null, function (pen, w, h) {
    var g = pen.ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.9)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.62)');
    g.addColorStop(1, 'rgba(0,0,0,0.08)');
    pen.ctx.fillStyle = g;
    pen.ctx.fillRect(0, 0, w, h);
  });

  // ------------------------------------------------------------ Numerales ---

  var GLYPHS = '0123456789';
  var CELL = { w: 34, h: 48 };

  recipe(FIXED, 'numerals', CELL.w * GLYPHS.length, CELL.h, function (pen, w, h) {
    for (var i = 0; i < GLYPHS.length; i++) {
      pen.label(GLYPHS[i], i * CELL.w + CELL.w / 2, h / 2 + 1,
        { size: 42, color: '#ffffff', outline: INK, outlineWidth: 8 });
    }
  });

  /** Descriptor que consume Phaser.GameObjects.RetroFont.Parse. */
  function numeralAtlas() {
    return {
      image: 'numerals',
      width: CELL.w,
      height: CELL.h,
      chars: GLYPHS,
      charsPerRow: GLYPHS.length,
      offset: { x: 0, y: 0 },
      spacing: { x: 0, y: 0 },
      lineSpacing: 0
    };
  }

  // -------------------------------------------------------------- Taller ---

  function paintTexture(scene, key, w, h, paint) {
    if (scene.textures.exists(key)) {
      var current = scene.textures.get(key).getSourceImage();
      if (current.width === w && current.height === h) { return; }
      scene.textures.remove(key);
    }
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var pen = new Pen(canvas.getContext('2d'));
    paint(pen, w, h);
    scene.textures.addCanvas(key, canvas);
  }

  global.Artwork = {
    CELL: CELL,
    numeralAtlas: numeralAtlas,

    /** Pinta todo lo que falte para el lienzo actual. */
    build: function (scene) {
      var key;
      for (key in FIXED) {
        if (FIXED.hasOwnProperty(key)) {
          paintTexture(scene, key, FIXED[key].w, FIXED[key].h, FIXED[key].paint);
        }
      }
      var w = scene.sys.game.config.width;
      var h = scene.sys.game.config.height;
      for (key in ELASTIC) {
        if (ELASTIC.hasOwnProperty(key)) {
          paintTexture(scene, key, w, h, ELASTIC[key].paint);
        }
      }
    }
  };

})(window);
