/*
 * icons.js — Dibuja por código los iconos de lanzador y el logotipo del arranque.
 *
 * No parte de ningún fichero de imagen: pinta sobre un lienzo dentro de
 * Chromium y vuelca los PNG que Android necesita en cada densidad.
 *
 *   node tools/icons.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// El dibujado se serializa al navegador, así que va como texto.
const SKETCH = `
const INK = '#1d2027';
const SWATCHES = ['#e8476b','#f2a83c','#74c93e','#35c98a','#33a8d1','#5a5fd6','#b74fd1'];

function roundedBox(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function blank(size, height) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = height || size;
  return c;
}

/* La escena del juego reducida a un cuadrado unidad. */
function emblem(ctx, s) {
  const u = (v) => v * s;

  roundedBox(ctx, u(0.05), u(0.10), u(0.145), u(0.80), u(0.072));
  ctx.fillStyle = SWATCHES[0];
  ctx.fill();
  roundedBox(ctx, u(0.805), u(0.10), u(0.145), u(0.80), u(0.072));
  ctx.fillStyle = SWATCHES[4];
  ctx.fill();

  ctx.save();
  ctx.translate(u(0.5), u(0.66));
  ctx.rotate(-Math.PI / 4);
  roundedBox(ctx, u(-0.28), u(-0.058), u(0.56), u(0.116), u(0.058));
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = u(0.028);
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(u(0.5), u(0.30), u(0.125), 0, Math.PI * 2);
  const shade = ctx.createRadialGradient(u(0.46), u(0.26), u(0.02), u(0.5), u(0.30), u(0.125));
  shade.addColorStop(0, '#ffd79a');
  shade.addColorStop(1, SWATCHES[1]);
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.lineWidth = u(0.028);
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/* kind: 'square' | 'round' | 'adaptive' */
function launcher(size, kind) {
  const c = blank(size);
  const ctx = c.getContext('2d');
  let inset;
  if (kind === 'square') {
    roundedBox(ctx, 0, 0, size, size, size * 0.22);
    ctx.fillStyle = INK;
    ctx.fill();
    inset = 0.84;
  } else if (kind === 'round') {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    inset = 0.74;
  } else {
    inset = 0.58;   // el recorte adaptativo deja libre solo el centro
  }
  const inner = size * inset;
  ctx.save();
  ctx.translate((size - inner) / 2, (size - inner) / 2);
  emblem(ctx, inner);
  ctx.restore();
  return c.toDataURL('image/png');
}

/* Logotipo del arranque, sobre fondo transparente. */
function splashMark(width) {
  const k = width / 640;
  const c = blank(width, Math.round(width * 0.72));
  const ctx = c.getContext('2d');

  const chip = 58 * k, gap = 12 * k;
  const span = SWATCHES.length * chip + (SWATCHES.length - 1) * gap;
  const x0 = (width - span) / 2;
  for (let i = 0; i < SWATCHES.length; i++) {
    roundedBox(ctx, x0 + i * (chip + gap), 40 * k, chip, chip, 16 * k);
    ctx.fillStyle = SWATCHES[i];
    ctx.fill();
    ctx.lineWidth = 5 * k;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold ' + Math.round(88 * k) + 'px "Arial Black",Arial,sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 20 * k;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText('VAIVÉN', width / 2, 196 * k);
  ctx.fillStyle = INK;
  ctx.fillText('VAIVÉN', width / 2, 196 * k);

  ctx.font = 'bold ' + Math.round(24 * k) + 'px "Arial Black",Arial,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText('DEVUELVE CADA COLOR A SU LADO', width / 2, 296 * k);

  ctx.beginPath();
  ctx.arc(width / 2, 384 * k, 32 * k, 0, Math.PI * 2);
  ctx.fillStyle = SWATCHES[1];
  ctx.fill();
  ctx.lineWidth = 7 * k;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  return c.toDataURL('image/png');
}
`;

function dump(file, dataUrl) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return `${path.relative(path.join(__dirname, '..'), file)} (${fs.statSync(file).size} B)`;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
  await page.addScriptTag({ content: SKETCH });

  const written = [];
  for (const [density, scale] of Object.entries(DENSITIES)) {
    const dir = path.join(RES, 'mipmap-' + density);
    const legacy = Math.round(48 * scale);
    const adaptive = Math.round(108 * scale);
    written.push(dump(path.join(dir, 'ic_launcher.png'),
      await page.evaluate(([s]) => launcher(s, 'square'), [legacy])));
    written.push(dump(path.join(dir, 'ic_launcher_round.png'),
      await page.evaluate(([s]) => launcher(s, 'round'), [legacy])));
    written.push(dump(path.join(dir, 'ic_launcher_foreground.png'),
      await page.evaluate(([s]) => launcher(s, 'adaptive'), [adaptive])));
  }

  written.push(dump(path.join(__dirname, '..', 'android', 'store-icon-512.png'),
    await page.evaluate(() => launcher(512, 'square'))));
  written.push(dump(path.join(RES, 'drawable-nodpi', 'splash_mark.png'),
    await page.evaluate(() => splashMark(640))));

  await browser.close();
  console.log(written.join('\n'));
})().catch((err) => { console.error(err); process.exit(1); });
