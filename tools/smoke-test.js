/*
 * Prueba de humo: arranca www/ en Chromium y comprueba que el juego genera
 * sus recursos, responde al táctil y que la física desvía la bola hasta las
 * paredes (que es lo único que hace avanzar el marcador).
 *
 *   node tools/smoke-test.js [--url http://localhost:8123] [--shots dir]
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
};
const URL = arg('url', 'http://localhost:8123/index.html');
const SHOTS = arg('shots', path.join(__dirname, '..', '.smoke'));
fs.mkdirSync(SHOTS, { recursive: true });

const TEXTURE_KEYS = [
  'titulo', 'pala', 'pala_sombra', 'bola', 'bola_sombra', 'flecha_derecha',
  'flecha_izquierda', 'pared_derecha', 'pared_izquierda', 'particula_estrella',
  'start_button', 'destello', 'copa', 'cierre_final', 'smash_button',
  'tutorial_back', 'flecha_tuto', 'bocina_on', 'bocina_off',
  'score_font', 'aviso_saque'
];
const AUDIO_KEYS = ['drop', 'crash_sound', 'bounce_sound', 'bg_music'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(ok, label, detail) {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

async function newPage(browser, storage, viewport) {
  const ctx = await browser.newContext({
    viewport: viewport || { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  if (storage) {
    await ctx.addInitScript((s) => {
      window.localStorage.setItem('selektorFile', s);
    }, storage);
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  page.errors = errors;
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game && window.game.isBooted, null, { timeout: 15000 });
  await sleep(1200);
  return { ctx, page };
}

/** Traduce coordenadas del juego a coordenadas de pantalla. El alto del lienzo
 *  depende de la proporción del dispositivo, así que se lee en cada toque. */
async function tap(page, gx, gy) {
  const p = await page.evaluate(([x, y]) => {
    const c = document.querySelector('#game-root canvas');
    const r = c.getBoundingClientRect();
    return {
      x: r.left + (x * r.width) / window.game.config.width,
      y: r.top + (y * r.height) / window.game.config.height
    };
  }, [gx, gy]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await sleep(60);
  await page.mouse.up();
  await sleep(120);
}

/** Pulsa un objeto del juego por su posición real (el alto del lienzo varía). */
async function tapObj(page, nombre) {
  const p = await page.evaluate((n) => ({ x: window[n].x, y: window[n].y }), nombre);
  await tap(page, p.x, p.y);
}

/**
 * Muestrea las cuatro esquinas de la pantalla a lo largo del ciclo del fondo y
 * cuenta cuántas salen blancas, que es el síntoma de que el bloque de barras no
 * llega a cubrirlas. Se decodifica el PNG en la propia página.
 */
async function esquinasBlancas(page, muestras) {
  let blancas = 0;
  for (let i = 0; i < muestras; i++) {
    await sleep(220);
    const png = (await page.screenshot()).toString('base64');
    const cols = await page.evaluate(async (d) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + d;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return [[1, 1], [img.width - 2, 1], [1, img.height - 2], [img.width - 2, img.height - 2]]
        .map(([x, y]) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3));
    }, png);
    for (const c of cols) {
      if (c[0] > 245 && c[1] > 245 && c[2] > 245) { blancas++; }
    }
  }
  return blancas;
}

/** El fondo gira 360°, así que su bloque de barras debe cubrir la diagonal del
 *  lienzo; si no, asoma el fondo blanco por las esquinas. */
const cobertura = (page) => page.evaluate(() => {
  const w = window.game.config.width, h = window.game.config.height;
  const barras = window.grupoBG.list;
  return {
    diagonal: Math.round(Math.sqrt(w * w + h * h)),
    ancho: Math.round(barras.length * barras[0].displayWidth),
    alto: Math.round(barras[0].displayHeight),
    n: barras.length
  };
});

const peek = (page) => page.evaluate(() => {
  // Tras scene.restart() los objetos siguen referenciados pero ya están
  // destruidos, así que se leen a la defensiva.
  const safe = (fn) => { try { return fn(); } catch (e) { return null; } };
  return {
    state: window.currentStateList[window.currentState],
    score: window.score,
    best: window.bestScore,
    onTutorial: window.onTutorial,
    ballX: safe(() => Math.round(window.bola.x)),
    ballY: safe(() => Math.round(window.bola.y)),
    ballStatic: safe(() => window.bola.body.isStatic),
    palaAngle: safe(() => Math.round(window.pala.angle))
  };
});

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle',
      '--use-angle=swiftshader', '--no-sandbox']
  });

  // ============ 1. Arranque limpio (sin partida guardada) ============
  console.log('\n[1] Arranque y menú');
  let { ctx, page } = await newPage(browser, null);

  const gen = await page.evaluate(([tk, ak]) => {
    const s = window.game.scene.scenes[0];
    return {
      renderer: window.game.renderer.type === 2 ? 'WebGL' : 'Canvas',
      missingTex: tk.filter((k) => !s.textures.exists(k)),
      missingAudio: ak.filter((k) => !s.cache.audio.exists(k)),
      audioKind: s.cache.audio.exists('bg_music')
        ? s.cache.audio.get('bg_music').constructor.name : null,
      musicSeconds: s.cache.audio.exists('bg_music')
        ? +s.cache.audio.get('bg_music').duration.toFixed(2) : null,
      sizes: {
        bola: [s.textures.get('bola').getSourceImage().width, s.textures.get('bola').getSourceImage().height],
        pala: [s.textures.get('pala').getSourceImage().width, s.textures.get('pala').getSourceImage().height],
        pared: [s.textures.get('pared_derecha').getSourceImage().width]
      }
    };
  }, [TEXTURE_KEYS, AUDIO_KEYS]);

  console.log('      renderer=' + gen.renderer + '  audio=' + gen.audioKind +
    ' (' + gen.musicSeconds + 's)  bola=' + gen.sizes.bola + ' pala=' + gen.sizes.pala);
  check(gen.missingTex.length === 0, `las ${TEXTURE_KEYS.length} texturas existen`,
    gen.missingTex.join(','));

  // El destello se escala hasta x2,2 centrado en el borde de la pared, así que
  // solo se ve la mitad. Antes ocupaba el 55 % del ancho y parecía que la bola
  // se estiraba.
  const flash = await page.evaluate(() => {
    const t = window.game.scene.scenes[0].textures.get('destello').getSourceImage();
    return { w: t.width, h: t.height, lienzo: window.game.config.width };
  });
  const ocupa = (flash.w * 2.2) / 2 / flash.lienzo;
  check(ocupa < 0.3, 'el destello no invade la pantalla al puntuar',
    `${flash.w}x${flash.h}, ocupa el ${Math.round(ocupa * 100)} % del ancho`);
  check(gen.missingAudio.length === 0, 'los 4 audios existen', gen.missingAudio.join(','));
  check(gen.audioKind === 'AudioBuffer', 'el audio es un AudioBuffer de Web Audio', gen.audioKind);
  const cob = await cobertura(page);
  check(Math.min(cob.ancho, cob.alto) >= cob.diagonal + 100,
    'el fondo giratorio cubre las esquinas (giro + vaivén de 50 px)',
    `${cob.n} barras, ${cob.ancho}x${cob.alto} sobre una diagonal de ${cob.diagonal}`);
  check(page.errors.length === 0, 'sin errores de consola', page.errors.join(' | '));
  await page.screenshot({ path: path.join(SHOTS, '01-menu.png') });

  // La esquina inferior derecha tiene que quedar libre: se retiró el botón de
  // información junto con su panel.
  const sobrantes = await page.evaluate(() => ['infoButton', 'infoAbout', 'fbButton',
    'instaButton', 'grupoAbout'].filter((n) => window[n] !== undefined));
  check(sobrantes.length === 0, 'no queda rastro del panel de información',
    sobrantes.join(','));

  // Silenciar / reactivar
  await tapObj(page, 'bocinaOn');
  await sleep(250);
  const muted = await page.evaluate(() => window.musicStatus);
  check(muted === 0, 'el botón de bocina silencia la música', 'musicStatus=' + muted);
  await tapObj(page, 'bocinaOff');
  await sleep(250);

  // ============ 2. Tutorial (bestScore < 4) ============
  console.log('\n[2] Tutorial y primera puntuación');
  await tapObj(page, 'startButton');
  await sleep(900);
  let st = await peek(page);
  check(st.state === 'actionPhase', 'entra en fase de juego', st.state);
  check(st.onTutorial === 1, 'activa el tutorial derecho', 'onTutorial=' + st.onTutorial);
  await sleep(600);
  await page.screenshot({ path: path.join(SHOTS, '03-tutorial.png') });

  await tapObj(page, 'botonPala45');    // smashButton sobre ese botón
  await sleep(300);
  st = await peek(page);
  check(st.onTutorial === 0 && st.ballStatic === false,
    'el toque suelta la bola y cierra el tutorial',
    'onTutorial=' + st.onTutorial + ' static=' + st.ballStatic);
  check(st.palaAngle === 45, 'la pala gira a 45°', 'angle=' + st.palaAngle);

  // La bola tiene que salir por un lateral: eso es lo que puntúa.
  const track = [];
  let scored = 0;
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    const s = await peek(page);
    track.push(`${s.ballX},${s.ballY}`);
    if (s.score > scored) scored = s.score;
    if (s.state !== 'actionPhase') break;
  }
  st = await peek(page);
  console.log('      trayectoria: ' + track.slice(0, 14).join(' → '));
  check(scored > 0, 'la bola llega a la pared derecha y puntúa', 'score=' + scored);
  await page.screenshot({ path: path.join(SHOTS, '04-juego.png') });

  // Al primer punto se encadena el segundo tutorial (lado izquierdo).
  check(st.onTutorial === 2, 'encadena el tutorial izquierdo', 'onTutorial=' + st.onTutorial);
  check(st.ballStatic === true, 'la bola queda en espera durante el tutorial');
  await page.screenshot({ path: path.join(SHOTS, '05-tutorial-izq.png') });
  await tapObj(page, 'botonPala125');
  await sleep(400);
  st = await peek(page);
  check(st.onTutorial === 0 && st.palaAngle === 125,
    'el segundo tutorial suelta la bola hacia la izquierda',
    'onTutorial=' + st.onTutorial + ' angle=' + st.palaAngle);
  for (let i = 0; i < 40 && (await peek(page)).state === 'actionPhase'; i++) {
    await sleep(150);
    const s = await peek(page);
    if (s.score > scored) { scored = s.score; break; }
  }
  check(scored >= 1, 'sigue la partida tras los tutoriales', 'score=' + scored);
  check(page.errors.length === 0, 'sin errores durante la partida', page.errors.join(' | '));
  await ctx.close();

  // ============ 3. Partida normal + fin + reinicio ============
  console.log('\n[3] Partida sin tutorial, fin de partida y reinicio');
  ({ ctx, page } = await newPage(browser, JSON.stringify({ bestScore: 12, musicStatus: 1 })));
  const best = await page.evaluate(() => window.bestScore);
  check(best === 12, 'lee el récord de localStorage', 'bestScore=' + best);
  const trophy = await page.evaluate(() => !!window.copa && !!window.scoreEnMenu);
  check(trophy, 'muestra la copa con el récord en el menú');
  await page.screenshot({ path: path.join(SHOTS, '06-menu-record.png') });

  await tapObj(page, 'startButton');
  await sleep(600);
  st = await peek(page);
  check(st.onTutorial === 0, 'sin tutorial cuando bestScore >= 4', 'onTutorial=' + st.onTutorial);

  // La partida no arranca hasta que el jugador toca la pantalla.
  const cy3 = await page.evaluate(() => window.game.config.height / 2);
  check(await page.evaluate(() => window.esperandoSaque) === true &&
    st.ballStatic === true, 'la bola espera quieta al empezar',
    'esperandoSaque=' + await page.evaluate(() => window.esperandoSaque));
  check(await page.evaluate(() => window.avisoSaque.x < 1000),
    'se muestra el aviso "toca para empezar"');
  await sleep(900);
  const quieta = await peek(page);
  check(quieta.ballY === 10, 'la bola no se mueve mientras se espera',
    'y=' + quieta.ballY);

  await tap(page, 160, cy3);            // toque para sacar
  await sleep(120);
  check(await page.evaluate(() => window.esperandoSaque) === false,
    'el toque suelta la bola');
  check(await page.evaluate(() => window.avisoSaque.x > 1000), 'el aviso desaparece al sacar');
  await sleep(500);
  const cayendo = await peek(page);
  check(cayendo.ballY > 10, 'la bola empieza a caer tras el toque', 'y=' + cayendo.ballY);

  // Se juega solo (la pala arranca a 125°); se espera al desenlace.
  let sawScore = 0, sawOver = false, sawMenu = false;
  for (let i = 0; i < 140; i++) {
    await sleep(150);
    const s = await peek(page);
    if (s.score > sawScore) sawScore = s.score;
    if (s.state === 'isTerminating') sawOver = true;
    if (sawOver && s.state === 'onMenu') { sawMenu = true; break; }
  }
  check(sawOver, 'la partida termina al fallar el color');
  check(sawMenu, 'la escena se reinicia y vuelve al menú');
  check(page.errors.length === 0, 'sin errores en el ciclo completo', page.errors.join(' | '));
  await page.screenshot({ path: path.join(SHOTS, '07-vuelta-menu.png') });
  console.log('      puntos logrados antes de fallar: ' + sawScore);
  await ctx.close();

  // ============ 4. Menú de ajustes ============
  console.log('\n[4] Ajustes: volúmenes, velocidad, controles y tutorial');
  ({ ctx, page } = await newPage(browser, JSON.stringify({ bestScore: 12, musicStatus: 1 })));

  await tapObj(page, 'ajustesButton');
  await sleep(350);
  // El panel se coloca respecto al centro del lienzo.
  const cy = await page.evaluate(() => window.game.config.height / 2);
  check(await page.evaluate(() => window.panelAjustes.abierto), 'el engranaje abre el panel');
  check(await page.evaluate(() => window.startButton.alpha < 0.2),
    'el panel oculta los botones del menú');
  await page.screenshot({ path: path.join(SHOTS, '08-ajustes.png') });

  // Deslizadores: x=44 es 0 %, x=276 es 100 %; filas en y=144/196/248.
  await tap(page, 160, cy - 94);
  let v = await page.evaluate(() => window.SelektorSettings.values.musicVolume);
  check(Math.abs(v - 0.5) < 0.03, 'la música se ajusta al 50 %', Math.round(v * 100) + '%');
  check(await page.evaluate(() => Math.abs(window.bgMusic.volume - 0.5) < 0.03),
    'el volumen se aplica a la música en curso');

  await tap(page, 44, cy - 42);
  check(await page.evaluate(() => window.SelektorSettings.values.sfxVolume) === 0,
    'los efectos bajan al 0 %');
  await tap(page, 276, cy - 42);
  v = await page.evaluate(() => window.SelektorSettings.values.sfxVolume);
  check(v === 1, 'los efectos suben al 100 %', Math.round(v * 100) + '%');

  await tap(page, 276, cy + 10);
  check(await page.evaluate(() => window.SelektorSettings.values.speedIndex) === 4,
    'la velocidad llega al último paso');
  await tap(page, 160, cy + 10);
  check(await page.evaluate(() => window.SelektorSettings.values.speedIndex) === 2,
    'la velocidad encaja en pasos discretos');
  await tap(page, 276, cy + 10);

  // El estado del interruptor se lee de la textura que hay en pantalla, no del
  // valor guardado: así se detecta que se dibuje encendido estando apagado.
  const estadoSwitch = () => page.evaluate(() => window.game.scene.scenes[0].children.list
    .filter((o) => o.texture && /ui_switch_(on|off)$/.test(o.texture.key) && o.visible)
    .map((o) => o.texture.key));
  check(JSON.stringify(await estadoSwitch()) === '["ui_switch_off"]',
    'el interruptor se dibuja apagado por defecto', JSON.stringify(await estadoSwitch()));
  await tap(page, 252, cy + 48);
  check(await page.evaluate(() => window.SelektorSettings.values.invertControls) === true,
    'el interruptor invierte los controles');
  check(JSON.stringify(await estadoSwitch()) === '["ui_switch_on"]',
    'el interruptor se dibuja encendido tras pulsarlo', JSON.stringify(await estadoSwitch()));

  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('selektorFile')));
  check(guardado.musicVolume === 0.5 && guardado.speedIndex === 4 &&
    guardado.invertControls === true && guardado.bestScore === 12,
    'los ajustes se guardan en localStorage sin perder el récord',
    JSON.stringify(guardado));

  // Silenciar la música por completo debe apagar el icono de la bocina.
  await tap(page, 44, cy - 94);
  check(await page.evaluate(() => window.musicStatus) === 0 &&
    await page.evaluate(() => window.bocinaOff.x < 100),
    'la música al 0 % apaga el icono de la bocina');
  await tap(page, 160, cy - 94);

  await tap(page, 160, cy + 144);       // CERRAR
  await sleep(350);
  check(!(await page.evaluate(() => window.panelAjustes.abierto)), 'el botón CERRAR cierra el panel');
  check(await page.evaluate(() => window.startButton.alpha > 0.8), 'el menú vuelve a aparecer');

  // Tutorial a demanda, con un récord muy por encima del umbral original.
  await tapObj(page, 'ajustesButton');
  await sleep(300);
  await tap(page, 160, cy + 94);        // VER TUTORIAL
  await sleep(1000);
  st = await peek(page);
  check(st.onTutorial === 1, 'VER TUTORIAL lanza el tutorial con bestScore=12',
    'onTutorial=' + st.onTutorial);
  const cfg = await page.evaluate(() => ({
    timeScale: window.game.scene.scenes[0].matter.world.engine.timing.timeScale,
    texDerecha: window.derecha.texture.key,
    texIzquierda: window.izquierda.texture.key,
    pulsa45EnIzquierda: window.botonPala45 === window.izquierda,
    volDrop: window.dropSound.volume
  }));
  check(Math.abs(cfg.timeScale - 1.3) < 0.001,
    'la velocidad se aplica a la simulación de Matter', 'timeScale=' + cfg.timeScale);
  check(cfg.texDerecha === 'flecha_izquierda' && cfg.texIzquierda === 'flecha_derecha',
    'los iconos de las flechas se intercambian al invertir');
  check(cfg.pulsa45EnIzquierda, 'el botón izquierdo pasa a desviar a la derecha');
  check(cfg.volDrop === 1, 'los efectos usan el volumen configurado', 'volumen=' + cfg.volDrop);
  await page.screenshot({ path: path.join(SHOTS, '09-tutorial-invertido.png') });

  // El tutorial forzado también encadena su segunda parte.
  await tapObj(page, 'botonPala45');     // ahora está a la izquierda
  await sleep(300);
  st = await peek(page);
  check(st.palaAngle === 45, 'el toque invertido gira la pala a 45°', 'angle=' + st.palaAngle);
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    st = await peek(page);
    if (st.onTutorial === 2 || st.state !== 'actionPhase') break;
  }
  check(st.onTutorial === 2, 'el tutorial a demanda encadena su segunda parte',
    'onTutorial=' + st.onTutorial + ' score=' + st.score);
  check(page.errors.length === 0, 'sin errores en el menú de ajustes', page.errors.join(' | '));
  await ctx.close();

  // ============ 5. Ajuste a distintas pantallas ============
  console.log('\n[5] El lienzo se adapta a la proporción de cada pantalla');
  const PANTALLAS = [
    { nombre: 'tableta 3:4', width: 768, height: 1024 },
    { nombre: 'móvil 16:9', width: 360, height: 640 },
    { nombre: 'móvil 19.5:9', width: 390, height: 844 },
    { nombre: 'móvil 20:9', width: 412, height: 915 }
  ];

  for (const p of PANTALLAS) {
    ({ ctx, page } = await newPage(browser, null, { width: p.width, height: p.height }));
    const m = await page.evaluate(() => {
      const canvas = document.querySelector('#game-root canvas');
      const caja = document.getElementById('game-root').getBoundingClientRect();
      const r = canvas.getBoundingClientRect();
      return {
        alto: window.game.config.height,
        ancho: window.game.config.width,
        cajaW: Math.round(caja.width), cajaH: Math.round(caja.height),
        lienzoW: r.width, lienzoH: r.height,
        cierre: (() => {
          const t = window.game.scene.scenes[0].textures.get('cierre_final').getSourceImage();
          return [t.width, t.height];
        })(),
        scrollX: document.documentElement.scrollWidth > window.innerWidth
      };
    });
    const esperado = Math.max(420, Math.min(800, Math.round(320 * (p.height / p.width))));
    const huecoX = m.cajaW - m.lienzoW, huecoY = m.cajaH - m.lienzoH;

    console.log(`      ${p.nombre} (${p.width}x${p.height}) → lienzo ${m.ancho}x${m.alto},` +
      ` sobra ${huecoX.toFixed(1)}x${huecoY.toFixed(1)} px`);
    check(m.alto === esperado, `${p.nombre}: alto del lienzo según la proporción`,
      m.alto + ' (esperado ' + esperado + ')');
    check(huecoX < 3 && huecoY < 3, `${p.nombre}: sin barras negras ni recorte`,
      'sobra ' + huecoX.toFixed(1) + 'x' + huecoY.toFixed(1) + ' px');
    check(m.cierre[0] === m.ancho && m.cierre[1] === m.alto,
      `${p.nombre}: el cierre de partida cubre todo el lienzo`, m.cierre.join('x'));
    check(!m.scrollX, `${p.nombre}: la página no desborda en horizontal`);
    const c = await cobertura(page);
    check(Math.min(c.ancho, c.alto) >= c.diagonal + 100,
      `${p.nombre}: el fondo cubre las esquinas al girar`,
      `${c.n} barras, ${c.ancho}x${c.alto} sobre una diagonal de ${c.diagonal}`);
    const blancas = await esquinasBlancas(page, 4);
    check(blancas === 0, `${p.nombre}: ninguna esquina deja ver el fondo blanco`,
      blancas + ' de 16 muestras');

    // La partida tiene que seguir siendo jugable con esa geometría.
    await tapObj(page, 'startButton');
    await sleep(900);
    await tapObj(page, 'botonPala45');
    let punt = 0;
    for (let i = 0; i < 60; i++) {
      await sleep(150);
      const e = await peek(page);
      if (e.score > punt) { punt = e.score; }
      if (punt > 0 || e.state !== 'actionPhase') { break; }
    }
    check(punt > 0, `${p.nombre}: la bola sigue llegando a la pared y puntúa`, 'score=' + punt);
    check(page.errors.length === 0, `${p.nombre}: sin errores`, page.errors.join(' | '));
    await page.screenshot({ path: path.join(SHOTS, `10-pantalla-${p.width}x${p.height}.png`) });
    await ctx.close();
  }

  // ============ 6. Reajuste en caliente ============
  // Es la ruta real de Android: el WebView arranca con las barras del sistema
  // visibles y se hace más alto en cuanto entra el modo inmersivo.
  console.log('\n[6] Reajuste al cambiar el tamaño del visor');
  ({ ctx, page } = await newPage(browser, null, { width: 390, height: 700 }));
  const antes = await page.evaluate(() => window.game.config.height);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(1200);
  const despues = await page.evaluate(() => ({
    alto: window.game.config.height,
    estado: window.currentStateList[window.currentState],
    hueco: (() => {
      const c = document.querySelector('#game-root canvas').getBoundingClientRect();
      const caja = document.getElementById('game-root').getBoundingClientRect();
      return Math.round(caja.height - c.height);
    })()
  }));
  console.log(`      ${antes} → ${despues.alto} px de alto de lienzo`);
  check(antes === 574, 'arranca con el alto del visor inicial', 'alto=' + antes);
  check(despues.alto === 693, 'se reajusta al crecer el visor', 'alto=' + despues.alto);
  check(despues.hueco < 3, 'sigue sin barras tras el reajuste', 'sobra ' + despues.hueco + ' px');
  check(despues.estado === 'onMenu', 'vuelve al menú tras reajustar', despues.estado);

  // Un cambio de tamaño en plena partida NO debe reiniciar la escena.
  await tapObj(page, 'startButton');
  await sleep(900);
  const enJuego = await page.evaluate(() => window.game.config.height);
  await page.setViewportSize({ width: 390, height: 760 });
  await sleep(1200);
  st = await peek(page);
  check(st.state === 'actionPhase' &&
    await page.evaluate(() => window.game.config.height) === enJuego,
    'no reajusta en plena partida (no se pierde la puntuación)', 'estado=' + st.state);
  check(page.errors.length === 0, 'sin errores al reajustar', page.errors.join(' | '));
  await ctx.close();

  await browser.close();
  console.log(failures === 0
    ? '\nTODO CORRECTO\n'
    : `\n${failures} COMPROBACIONES FALLIDAS\n`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
