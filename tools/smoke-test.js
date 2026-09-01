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
  'tutorial_back', 'flecha_tuto', 'bocina_on', 'bocina_off', 'info_button',
  'info_about', 'fb_button', 'insta_button', 'score_font'
];
const AUDIO_KEYS = ['drop', 'crash_sound', 'bounce_sound', 'bg_music'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(ok, label, detail) {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

async function newPage(browser, storage) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
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

/** Traduce coordenadas del juego (320x480) a coordenadas de pantalla. */
async function tap(page, gx, gy) {
  const p = await page.evaluate(([x, y]) => {
    const c = document.querySelector('#game-root canvas');
    const r = c.getBoundingClientRect();
    return { x: r.left + (x * r.width) / 320, y: r.top + (y * r.height) / 480 };
  }, [gx, gy]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await sleep(60);
  await page.mouse.up();
  await sleep(120);
}

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
  check(gen.missingTex.length === 0, 'las 24 texturas existen', gen.missingTex.join(','));
  check(gen.missingAudio.length === 0, 'los 4 audios existen', gen.missingAudio.join(','));
  check(gen.audioKind === 'AudioBuffer', 'el audio es un AudioBuffer de Web Audio', gen.audioKind);
  check(page.errors.length === 0, 'sin errores de consola', page.errors.join(' | '));
  await page.screenshot({ path: path.join(SHOTS, '01-menu.png') });

  // Panel "acerca de"
  await tap(page, 293, 453);
  await sleep(400);
  const aboutAlpha = await page.evaluate(() => window.grupoAbout.alpha);
  check(aboutAlpha > 0.9, 'el botón de info abre el panel', 'alpha=' + aboutAlpha);
  await page.screenshot({ path: path.join(SHOTS, '02-about.png') });
  await tap(page, 293, 453);
  await sleep(400);

  // Silenciar / reactivar
  await tap(page, 29, 451);
  await sleep(250);
  const muted = await page.evaluate(() => window.musicStatus);
  check(muted === 0, 'el botón de bocina silencia la música', 'musicStatus=' + muted);
  await tap(page, 29, 451);
  await sleep(250);

  // ============ 2. Tutorial (bestScore < 4) ============
  console.log('\n[2] Tutorial y primera puntuación');
  await tap(page, 160, 240);            // START
  await sleep(900);
  let st = await peek(page);
  check(st.state === 'actionPhase', 'entra en fase de juego', st.state);
  check(st.onTutorial === 1, 'activa el tutorial derecho', 'onTutorial=' + st.onTutorial);
  await sleep(600);
  await page.screenshot({ path: path.join(SHOTS, '03-tutorial.png') });

  await tap(page, 260, 380);            // smashButton sobre la flecha derecha
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
  await tap(page, 60, 380);             // smashButton sobre la flecha izquierda
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

  await tap(page, 160, 240);
  await sleep(600);
  st = await peek(page);
  check(st.onTutorial === 0, 'sin tutorial cuando bestScore >= 4', 'onTutorial=' + st.onTutorial);

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

  await tap(page, 81, 451);             // engranaje
  await sleep(350);
  check(await page.evaluate(() => window.panelAjustes.abierto), 'el engranaje abre el panel');
  check(await page.evaluate(() => window.startButton.alpha < 0.2),
    'el panel oculta los botones del menú');
  await page.screenshot({ path: path.join(SHOTS, '08-ajustes.png') });

  // Deslizadores: x=44 es 0 %, x=276 es 100 %; filas en y=144/196/248.
  await tap(page, 160, 144);
  let v = await page.evaluate(() => window.SelektorSettings.values.musicVolume);
  check(Math.abs(v - 0.5) < 0.03, 'la música se ajusta al 50 %', Math.round(v * 100) + '%');
  check(await page.evaluate(() => Math.abs(window.bgMusic.volume - 0.5) < 0.03),
    'el volumen se aplica a la música en curso');

  await tap(page, 44, 196);
  check(await page.evaluate(() => window.SelektorSettings.values.sfxVolume) === 0,
    'los efectos bajan al 0 %');
  await tap(page, 276, 196);
  v = await page.evaluate(() => window.SelektorSettings.values.sfxVolume);
  check(v === 1, 'los efectos suben al 100 %', Math.round(v * 100) + '%');

  await tap(page, 276, 248);
  check(await page.evaluate(() => window.SelektorSettings.values.speedIndex) === 4,
    'la velocidad llega al último paso');
  await tap(page, 160, 248);
  check(await page.evaluate(() => window.SelektorSettings.values.speedIndex) === 2,
    'la velocidad encaja en pasos discretos');
  await tap(page, 276, 248);

  // El estado del interruptor se lee de la textura que hay en pantalla, no del
  // valor guardado: así se detecta que se dibuje encendido estando apagado.
  const estadoSwitch = () => page.evaluate(() => window.game.scene.scenes[0].children.list
    .filter((o) => o.texture && /ui_switch_(on|off)$/.test(o.texture.key) && o.visible)
    .map((o) => o.texture.key));
  check(JSON.stringify(await estadoSwitch()) === '["ui_switch_off"]',
    'el interruptor se dibuja apagado por defecto', JSON.stringify(await estadoSwitch()));
  await tap(page, 252, 286);
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
  await tap(page, 44, 144);
  check(await page.evaluate(() => window.musicStatus) === 0 &&
    await page.evaluate(() => window.bocinaOff.x < 100),
    'la música al 0 % apaga el icono de la bocina');
  await tap(page, 160, 144);

  await tap(page, 160, 382);            // CERRAR
  await sleep(350);
  check(!(await page.evaluate(() => window.panelAjustes.abierto)), 'el botón CERRAR cierra el panel');
  check(await page.evaluate(() => window.startButton.alpha > 0.8), 'el menú vuelve a aparecer');

  // Tutorial a demanda, con un récord muy por encima del umbral original.
  await tap(page, 81, 451);
  await sleep(300);
  await tap(page, 160, 332);            // VER TUTORIAL
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
  await tap(page, 60, 380);             // ahora el botón de 45° está a la izquierda
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

  await browser.close();
  console.log(failures === 0
    ? '\nTODO CORRECTO\n'
    : `\n${failures} COMPROBACIONES FALLIDAS\n`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
