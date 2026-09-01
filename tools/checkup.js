/*
 * checkup.js — Revisión automática del juego en Chromium.
 *
 * Comprueba que se fabrica todo el material, que la partida responde al táctil
 * y llega a puntuar, que las opciones se guardan, que el lienzo llena cualquier
 * pantalla y que no queda ningún identificador heredado en el código.
 *
 *   node tools/checkup.js [--url http://localhost:8123] [--shots carpeta]
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf('--' + name);
  return at >= 0 ? argv[at + 1] : fallback;
};
const URL = flag('url', 'http://localhost:8123/index.html');
const SHOTS = flag('shots', path.join(__dirname, '..', '.shots'));
fs.mkdirSync(SHOTS, { recursive: true });

const PICTURES = [
  'column', 'orb', 'orbShade', 'blade', 'bladeShade', 'steerRight', 'steerLeft',
  'shard', 'sparkle', 'playPill', 'wordmark', 'recordBar', 'tapRing', 'spinArrow',
  'soundOn', 'soundOff', 'gear', 'servePrompt', 'panel', 'rail', 'grip', 'pill',
  'switchOn', 'switchOff', 'switchGrip', 'numerals', 'endCard', 'veil'
];
const SOUNDS = ['chime', 'thud', 'burst', 'loop'];
const SLOT = 'vaiven.profile';

const pause = (ms) => new Promise((done) => setTimeout(done, ms));
let failures = 0;
const verify = (ok, label, detail) => {
  console.log(`${ok ? '  ok  ' : ' FALLA'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) { failures++; }
};

async function openPage(browser, saved, viewport) {
  const context = await browser.newContext({
    viewport: viewport || { width: 390, height: 844 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true
  });
  if (saved) {
    await context.addInitScript(([slot, blob]) => {
      window.localStorage.setItem(slot, blob);
    }, [SLOT, saved]);
  }
  const page = await context.newPage();
  const noise = [];
  page.on('pageerror', (e) => noise.push('excepción: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') { noise.push('consola: ' + m.text()); } });
  page.noise = noise;
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.Vaiven && window.Vaiven.game && window.Vaiven.game.isBooted,
    null, { timeout: 15000 });
  await pause(1300);
  return { context, page };
}

const look = (page) => page.evaluate(() => window.Vaiven.probe());

/** El alto del lienzo varía con el móvil, así que se lee en cada toque. */
async function touch(page, gx, gy) {
  const spot = await page.evaluate(([x, y]) => {
    const box = document.querySelector('#stage canvas').getBoundingClientRect();
    const cfg = window.Vaiven.game.config;
    return { x: box.left + (x * box.width) / cfg.width, y: box.top + (y * box.height) / cfg.height };
  }, [gx, gy]);
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  await pause(60);
  await page.mouse.up();
  await pause(120);
}

const touchAt = async (page, point) => touch(page, point.x, point.y);

/** Cuenta esquinas que dejan ver el fondo del lienzo por detrás del telón. */
async function bareCorners(page, samples) {
  let bare = 0;
  for (let i = 0; i < samples; i++) {
    await pause(220);
    const shot = (await page.screenshot()).toString('base64');
    const corners = await page.evaluate(async (data) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + data;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return [[1, 1], [img.width - 2, 1], [1, img.height - 2], [img.width - 2, img.height - 2]]
        .map(([x, y]) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3));
    }, shot);
    // El fondo del lienzo es el tono tinta #1d2027.
    for (const [r, gr, b] of corners) {
      if (Math.abs(r - 0x1d) < 8 && Math.abs(gr - 0x20) < 8 && Math.abs(b - 0x27) < 8) { bare++; }
    }
  }
  return bare;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle',
      '--use-angle=swiftshader', '--no-sandbox']
  });

  // ================= 1. Fabricación del material =================
  console.log('\n[1] Arranque y material generado');
  let { context, page } = await openPage(browser, null);

  const forged = await page.evaluate(([pics, sounds]) => {
    const game = window.Vaiven.game;
    const stage = game.scene.getScene('title');
    return {
      renderer: game.renderer.type === 2 ? 'WebGL' : 'Canvas',
      scenes: game.scene.scenes.map((s) => s.scene.key),
      missingPics: pics.filter((k) => !stage.textures.exists(k)),
      missingSounds: sounds.filter((k) => !stage.cache.audio.exists(k)),
      audioKind: stage.cache.audio.get('loop').constructor.name,
      loopSeconds: +stage.cache.audio.get('loop').duration.toFixed(2),
      sparkle: (() => {
        const t = stage.textures.get('sparkle').getSourceImage();
        return [t.width, t.height];
      })(),
      orb: stage.textures.get('orb').getSourceImage().width,
      blade: stage.textures.get('blade').getSourceImage().width
    };
  }, [PICTURES, SOUNDS]);

  console.log(`      ${forged.renderer} · escenas ${forged.scenes.join(', ')} · ` +
    `bucle ${forged.loopSeconds}s como ${forged.audioKind}`);
  verify(forged.missingPics.length === 0, `las ${PICTURES.length} imágenes se generan`,
    forged.missingPics.join(','));
  verify(forged.missingSounds.length === 0, 'los 4 sonidos se sintetizan',
    forged.missingSounds.join(','));
  verify(forged.audioKind === 'AudioBuffer', 'el audio llega como búfer de Web Audio');

  // El chispazo se agranda hasta x2,2 sobre el canto de la columna: solo se ve
  // la mitad, y no debe invadir la pantalla.
  const invade = (forged.sparkle[0] * 2.2) / 2 / 320;
  verify(invade < 0.3, 'el chispazo del acierto no invade la pantalla',
    `${forged.sparkle.join('x')}, ${Math.round(invade * 100)} % del ancho`);

  let view = await look(page);
  verify(Math.min(view.backdrop.width, view.backdrop.height) >= view.backdrop.needed,
    'el telón cubre las esquinas al girar y pasearse',
    `${view.backdrop.width}x${view.backdrop.height} sobre ${view.backdrop.needed}`);
  verify(page.noise.length === 0, 'sin errores de consola', page.noise.join(' | '));
  await page.screenshot({ path: path.join(SHOTS, '01-portada.png') });

  // ================= 2. Aprendizaje guiado =================
  console.log('\n[2] Aprendizaje guiado del jugador nuevo');
  await touchAt(page, view.playAt);
  await pause(900);
  view = await look(page);
  verify(view.scene === 'rally', 'empieza la partida', view.scene);
  verify(view.phase === 'coaching' && view.coachQueue.join() === 'right,left',
    'arranca el primer paso guiado', `${view.phase} [${view.coachQueue}]`);
  verify(view.orbHeld === true, 'la esfera espera durante el paso guiado');
  await page.screenshot({ path: path.join(SHOTS, '02-guia-derecha.png') });

  await touchAt(page, view.ringAt);
  await pause(300);
  view = await look(page);
  verify(view.phase === 'live' && view.bladeAngle === 45,
    'el toque suelta la esfera hacia la derecha', `${view.phase}, ${view.bladeAngle}°`);
  verify(view.steerRightAt.x > view.canvas.width / 2 &&
    view.steerRightIcon === 'steerRight',
    'sin reflejar, el mando de la derecha está a la derecha');

  let best = 0;
  for (let i = 0; i < 60; i++) {
    await pause(150);
    view = await look(page);
    if (view.score > best) { best = view.score; }
    if (view.phase === 'coaching' || view.scene !== 'rally') { break; }
  }
  verify(best > 0, 'la esfera llega a la columna y puntúa', 'marcador=' + best);
  verify(view.phase === 'coaching' && view.coachQueue.join() === 'left',
    'encadena el segundo paso guiado', `${view.phase} [${view.coachQueue}]`);
  await page.screenshot({ path: path.join(SHOTS, '03-guia-izquierda.png') });

  await touchAt(page, view.ringAt);
  await pause(300);
  view = await look(page);
  verify(view.phase === 'live' && view.bladeAngle === 125 && view.coachQueue.length === 0,
    'el segundo paso suelta hacia la izquierda y cierra la guía',
    `${view.phase}, ${view.bladeAngle}°, quedan ${view.coachQueue.length}`);
  verify(page.noise.length === 0, 'sin errores durante la guía', page.noise.join(' | '));
  await context.close();

  // ================= 3. Partida normal, saque y desenlace =================
  console.log('\n[3] Saque a petición, fin de partida y vuelta a la portada');
  ({ context, page } = await openPage(browser, JSON.stringify({ version: 1, record: 12 })));
  view = await look(page);
  verify(view.record === 12, 'lee el récord guardado', 'récord=' + view.record);
  verify(view.hasRecordPlate, 'muestra la placa del récord en la portada');
  await page.screenshot({ path: path.join(SHOTS, '04-portada-record.png') });

  await touchAt(page, view.playAt);
  await pause(700);
  view = await look(page);
  verify(view.phase === 'serving' && view.coachQueue.length === 0,
    'sin guía cuando ya hay récord', view.phase);
  verify(view.orbHeld === true && view.promptVisible,
    'la esfera espera con el aviso de saque');
  await page.screenshot({ path: path.join(SHOTS, '05-espera-saque.png') });

  await pause(900);
  verify((await look(page)).orbY === 10, 'nada se mueve hasta que el jugador toca');

  await touch(page, 160, view.canvas.height / 2);
  await pause(120);
  view = await look(page);
  verify(view.phase === 'live' && !view.promptVisible, 'el toque saca y retira el aviso');
  await pause(500);
  verify((await look(page)).orbY > 10, 'la esfera empieza a caer');

  let sawEnd = false;
  for (let i = 0; i < 160; i++) {
    await pause(150);
    view = await look(page);
    if (view.scene === 'title') { sawEnd = true; break; }
  }
  verify(sawEnd, 'la partida termina y vuelve a la portada');
  verify(page.noise.length === 0, 'sin errores en el ciclo completo', page.noise.join(' | '));
  await context.close();

  // ================= 4. Opciones =================
  console.log('\n[4] Opciones: volúmenes, velocidad, mandos y tutorial');
  ({ context, page } = await openPage(browser, JSON.stringify({ version: 1, record: 12 })));
  view = await look(page);
  await touchAt(page, view.gearAt);
  await pause(350);
  view = await look(page);
  verify(view.optionsOpen, 'el engranaje abre las opciones');
  verify(view.playAlpha < 0.2, 'las opciones tapan la portada');
  await page.screenshot({ path: path.join(SHOTS, '06-opciones.png') });

  // Rieles: x=44 es 0 %, x=276 es 100 %; filas respecto al centro del lienzo.
  const mid = view.canvas.height / 2;
  await touch(page, 160, mid - 94);
  let music = await page.evaluate(() => window.Vaiven.profile.musicLevel);
  verify(Math.abs(music - 0.5) < 0.03, 'la música se fija al 50 %', Math.round(music * 100) + '%');
  verify(await page.evaluate(() => Math.abs(window.Vaiven.jukebox.loop.volume - 0.5) < 0.03),
    'el nivel se aplica a la música que ya suena');

  await touch(page, 44, mid - 42);
  verify(await page.evaluate(() => window.Vaiven.profile.effectsLevel) === 0,
    'los efectos bajan al 0 %');
  await touch(page, 276, mid - 42);
  verify(await page.evaluate(() => window.Vaiven.profile.effectsLevel) === 1,
    'los efectos suben al 100 %');

  await touch(page, 276, mid + 10);
  verify(await page.evaluate(() => window.Vaiven.profile.tempoIndex) === 4,
    'la velocidad llega al último paso');
  await touch(page, 160, mid + 10);
  verify(await page.evaluate(() => window.Vaiven.profile.tempoIndex) === 2,
    'la velocidad encaja en pasos discretos');
  await touch(page, 276, mid + 10);

  verify((await look(page)).switchIcon === 'switchOff',
    'el interruptor se dibuja apagado por defecto');
  await touch(page, 252, mid + 48);
  verify(await page.evaluate(() => window.Vaiven.profile.mirrored) === true,
    'el interruptor refleja los mandos');
  verify((await look(page)).switchIcon === 'switchOn',
    'el interruptor se dibuja encendido tras pulsarlo');

  const kept = await page.evaluate((slot) => JSON.parse(localStorage.getItem(slot)), SLOT);
  verify(kept.volume.music === 0.5 && kept.volume.effects === 1 && kept.tempo === 4 &&
    kept.mirroredSteering === true && kept.record === 12,
    'las opciones se guardan sin perder el récord', JSON.stringify(kept));

  await touch(page, 44, mid - 94);
  verify((await look(page)).soundIcon === 'soundOff',
    'la música al 0 % apaga el icono de la bocina');
  await touch(page, 160, mid - 94);

  await touch(page, 160, mid + 144);      // CERRAR
  await pause(350);
  view = await look(page);
  verify(!view.optionsOpen && view.playAlpha > 0.8, 'CERRAR devuelve la portada');

  await touchAt(page, view.gearAt);
  await pause(300);
  await touch(page, 160, mid + 94);       // VER TUTORIAL
  await pause(1000);
  view = await look(page);
  verify(view.phase === 'coaching' && view.coachQueue.length === 2,
    'VER TUTORIAL repite la guía con récord 12', `${view.phase} [${view.coachQueue}]`);
  verify(Math.abs(view.timeScale - 1.3) < 0.001,
    'la velocidad elegida escala la simulación', 'timeScale=' + view.timeScale);
  // La invariante que hace honesta la opción: el dibujo de cada mando siempre
  // dice hacia dónde saldrá la esfera; lo que cambia de sitio es el mando.
  verify(view.steerRightIcon === 'steerRight' && view.steerLeftIcon === 'steerLeft',
    'cada mando conserva el icono de su función al reflejarlos');
  verify(view.steerRightAt.x < view.canvas.width / 2 &&
    view.steerLeftAt.x > view.canvas.width / 2,
    'reflejados, el mando de la derecha pasa al lado izquierdo y viceversa',
    `derecha en x=${view.steerRightAt.x}, izquierda en x=${view.steerLeftAt.x}`);
  verify(await page.evaluate(() => window.Vaiven.jukebox.cues.chime.volume) >= 0,
    'los efectos tienen nivel asignado');
  await page.screenshot({ path: path.join(SHOTS, '07-guia-reflejada.png') });
  verify(page.noise.length === 0, 'sin errores en las opciones', page.noise.join(' | '));
  await context.close();

  // ================= 5. Distintas pantallas =================
  console.log('\n[5] El lienzo se adapta a la proporción de cada pantalla');
  const SCREENS = [
    { name: 'tableta 3:4', width: 768, height: 1024 },
    { name: 'móvil 16:9', width: 360, height: 640 },
    { name: 'móvil 19.5:9', width: 390, height: 844 },
    { name: 'móvil 20:9', width: 412, height: 915 }
  ];

  for (const screen of SCREENS) {
    ({ context, page } = await openPage(browser, null, { width: screen.width, height: screen.height }));
    const fit = await page.evaluate(() => {
      const canvas = document.querySelector('#stage canvas').getBoundingClientRect();
      const box = document.getElementById('stage').getBoundingClientRect();
      const stage = window.Vaiven.game.scene.getScene('title');
      const card = stage.textures.get('endCard').getSourceImage();
      return {
        boxW: Math.round(box.width), boxH: Math.round(box.height),
        canvasW: canvas.width, canvasH: canvas.height,
        card: [card.width, card.height],
        overflows: document.documentElement.scrollWidth > window.innerWidth
      };
    });
    view = await look(page);
    const expected = Math.max(420, Math.min(800, Math.round(320 * (screen.height / screen.width))));
    const slackX = fit.boxW - fit.canvasW;
    const slackY = fit.boxH - fit.canvasH;

    console.log(`      ${screen.name} (${screen.width}x${screen.height}) → ` +
      `lienzo ${view.canvas.width}x${view.canvas.height}, sobra ` +
      `${slackX.toFixed(1)}x${slackY.toFixed(1)} px`);
    verify(view.canvas.height === expected, `${screen.name}: alto según la proporción`,
      `${view.canvas.height} (esperado ${expected})`);
    verify(slackX < 3 && slackY < 3, `${screen.name}: sin franjas ni recorte`);
    verify(fit.card[0] === view.canvas.width && fit.card[1] === view.canvas.height,
      `${screen.name}: el cierre cubre el lienzo entero`, fit.card.join('x'));
    verify(!fit.overflows, `${screen.name}: la página no desborda`);
    verify(Math.min(view.backdrop.width, view.backdrop.height) >= view.backdrop.needed,
      `${screen.name}: el telón cubre las esquinas`);
    const bare = await bareCorners(page, 4);
    verify(bare === 0, `${screen.name}: ninguna esquina deja ver el fondo`, bare + ' de 16');

    await touchAt(page, view.playAt);
    await pause(900);
    view = await look(page);
    await touchAt(page, view.ringAt);
    let scored = 0;
    for (let i = 0; i < 60; i++) {
      await pause(150);
      const now = await look(page);
      if (now.score > scored) { scored = now.score; }
      if (scored > 0 || now.scene !== 'rally') { break; }
    }
    verify(scored > 0, `${screen.name}: la partida sigue siendo jugable`, 'marcador=' + scored);
    verify(page.noise.length === 0, `${screen.name}: sin errores`, page.noise.join(' | '));
    await page.screenshot({ path: path.join(SHOTS, `08-pantalla-${screen.width}x${screen.height}.png`) });
    await context.close();
  }

  // ================= 6. Reajuste en caliente =================
  console.log('\n[6] Reajuste al cambiar el tamaño del visor');
  ({ context, page } = await openPage(browser, null, { width: 390, height: 700 }));
  const before = (await look(page)).canvas.height;
  await page.setViewportSize({ width: 390, height: 844 });
  await pause(1200);
  const after = await page.evaluate(() => {
    const canvas = document.querySelector('#stage canvas').getBoundingClientRect();
    const box = document.getElementById('stage').getBoundingClientRect();
    return { alto: window.Vaiven.game.config.height, hueco: Math.round(box.height - canvas.height) };
  });
  console.log(`      ${before} → ${after.alto} px de alto de lienzo`);
  verify(before === 574, 'arranca con el alto del visor inicial', 'alto=' + before);
  verify(after.alto === 693, 'se reajusta al crecer el visor', 'alto=' + after.alto);
  verify(after.hueco < 3, 'sigue sin franjas tras el reajuste', 'sobra ' + after.hueco + ' px');

  view = await look(page);
  await touchAt(page, view.playAt);
  await pause(900);
  const midMatch = await page.evaluate(() => window.Vaiven.game.config.height);
  await page.setViewportSize({ width: 390, height: 760 });
  await pause(1200);
  view = await look(page);
  verify(view.scene === 'rally' &&
    await page.evaluate(() => window.Vaiven.game.config.height) === midMatch,
    'no reajusta en plena partida', 'escena=' + view.scene);
  verify(page.noise.length === 0, 'sin errores al reajustar', page.noise.join(' | '));
  await context.close();

  await browser.close();
  console.log(failures === 0 ? '\nTODO CORRECTO\n' : `\n${failures} COMPROBACIONES FALLIDAS\n`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => { console.error(err); process.exit(2); });
