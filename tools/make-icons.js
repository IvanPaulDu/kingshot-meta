/*
 * Genera por código los iconos de lanzador y el splash de la app Android.
 * No hay ficheros de imagen de partida: se dibuja todo en un canvas dentro
 * de Chromium y se vuelca a PNG.
 *
 *   node tools/make-icons.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// Dibujado compartido; se serializa al navegador.
const DRAW = `
const INK = '#14171d';
const PAL = ['#ff2a36','#6aca32','#ffa9bd','#f4c329','#5e97d6','#b44ea4','#36f1e6'];

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

/* Composición del icono en un cuadrado unidad, escalada por el llamante. */
function drawMark(ctx, s) {
  const u = (v) => v * s;
  // Paredes de color a los lados
  roundRect(ctx, u(0.05), u(0.10), u(0.145), u(0.80), u(0.072));
  ctx.fillStyle = PAL[0]; ctx.fill();
  roundRect(ctx, u(0.805), u(0.10), u(0.145), u(0.80), u(0.072));
  ctx.fillStyle = PAL[4]; ctx.fill();

  // Pala inclinada, como cuando desvía hacia la derecha
  ctx.save();
  ctx.translate(u(0.5), u(0.66));
  ctx.rotate(-Math.PI / 4);
  roundRect(ctx, u(-0.28), u(-0.058), u(0.56), u(0.116), u(0.058));
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.lineWidth = u(0.028); ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();

  // Bola cayendo
  ctx.beginPath();
  ctx.arc(u(0.5), u(0.30), u(0.125), 0, Math.PI*2);
  const g = ctx.createRadialGradient(u(0.46), u(0.26), u(0.02), u(0.5), u(0.30), u(0.125));
  g.addColorStop(0, '#ffe9a0'); g.addColorStop(1, PAL[3]);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = u(0.028); ctx.strokeStyle = INK; ctx.stroke();
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return c;
}

/* kind: 'legacy' | 'round' | 'foreground' */
function icon(size, kind) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  let inner;
  if (kind === 'legacy') {
    roundRect(ctx, 0, 0, size, size, size*0.22);
    ctx.fillStyle = INK; ctx.fill();
    inner = 0.84;
  } else if (kind === 'round') {
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
    ctx.fillStyle = INK; ctx.fill();
    inner = 0.74;
  } else {
    // Icono adaptativo: todo el contenido dentro de la zona segura (66%).
    inner = 0.58;
  }
  const s = size * inner;
  ctx.save();
  ctx.translate((size - s)/2, (size - s)/2);
  drawMark(ctx, s);
  ctx.restore();
  return c.toDataURL('image/png');
}

/* Logotipo del splash sobre fondo transparente. */
function splashLogo(w) {
  const h = Math.round(w * 0.72);
  const c = makeCanvas(w); c.height = h;
  const ctx = c.getContext('2d');
  const k = w / 640;

  const chipW = 58*k, chipH = 58*k, gap = 12*k;
  const total = PAL.length*chipW + (PAL.length-1)*gap;
  let x0 = (w - total)/2;
  for (let i = 0; i < PAL.length; i++) {
    roundRect(ctx, x0 + i*(chipW+gap), 40*k, chipW, chipH, 16*k);
    ctx.fillStyle = PAL[i]; ctx.fill();
    ctx.lineWidth = 5*k; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold ' + Math.round(92*k) + 'px "Arial Black",Arial,sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 20*k;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText('SELEKTOR', w/2, 190*k);
  ctx.fillStyle = INK;
  ctx.fillText('SELEKTOR', w/2, 190*k);

  ctx.font = 'bold ' + Math.round(26*k) + 'px "Arial Black",Arial,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText('REBOTA · ACIERTA · REPITE', w/2, 290*k);

  ctx.beginPath();
  ctx.arc(w/2, 380*k, 34*k, 0, Math.PI*2);
  ctx.fillStyle = PAL[3]; ctx.fill();
  ctx.lineWidth = 7*k; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  return c.toDataURL('image/png');
}
`;

function write(file, dataUrl) {
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
  await page.addScriptTag({ content: DRAW });

  const made = [];
  for (const [dpi, scale] of Object.entries(DENSITIES)) {
    const dir = path.join(RES, 'mipmap-' + dpi);
    const legacy = Math.round(48 * scale);
    const fg = Math.round(108 * scale);
    made.push(write(path.join(dir, 'ic_launcher.png'),
      await page.evaluate(([s]) => icon(s, 'legacy'), [legacy])));
    made.push(write(path.join(dir, 'ic_launcher_round.png'),
      await page.evaluate(([s]) => icon(s, 'round'), [legacy])));
    made.push(write(path.join(dir, 'ic_launcher_foreground.png'),
      await page.evaluate(([s]) => icon(s, 'foreground'), [fg])));
  }

  // Play Store / icono de alta resolución, útil al publicar.
  made.push(write(path.join(__dirname, '..', 'android', 'icon-512.png'),
    await page.evaluate(() => icon(512, 'legacy'))));

  made.push(write(path.join(RES, 'drawable-nodpi', 'splash_logo.png'),
    await page.evaluate(() => splashLogo(640))));

  await browser.close();
  console.log(made.join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
