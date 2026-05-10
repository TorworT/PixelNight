#!/usr/bin/env node
/**
 * scripts/generate-assets.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Génère les assets visuels de PixelNight en pixel art pur (SVG→PNG via sharp).
 *
 *   assets/icon.png          1024×1024  — icône App Store / Play Store
 *   assets/adaptive-icon.png 1024×1024  — icône Android adaptive (foreground)
 *   assets/splash-icon.png   2048×2048  — écran de chargement
 *
 * Usage : node scripts/generate-assets.js
 */

'use strict';

const path = require('path');
let   sharp;

try {
  sharp = require('sharp');
} catch {
  console.error('❌  sharp non trouvé. Lancez : npm install --save-dev sharp');
  process.exit(1);
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const BG    = '#0f0f1a';
const RED   = '#e94560';
const WHITE = '#ffffff';

// ─── Police pixel art (grille 5×7) ───────────────────────────────────────────

const FONT = {
  P: [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0]],
  I: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1]],
  X: [[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[1,0,0,0,1]],
  E: [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  L: [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  N: [[1,0,0,0,1],[1,1,0,0,1],[1,0,1,0,1],[1,0,0,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  G: [[0,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  H: [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  T: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function measureText(str, px) {
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === ' ') { w += px * 3; continue; }
    const g = FONT[ch];
    if (!g) continue;
    w += g[0].length * px;
    if (i < str.length - 1) w += px;
  }
  return w;
}

function renderText(str, x0, y0, px, color) {
  let out = '';
  let cx  = x0;
  for (let i = 0; i < str.length; i++) {
    const ch   = str[i];
    if (ch === ' ') { cx += px * 3; continue; }
    const grid = FONT[ch];
    if (!grid) continue;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c]) {
          out += `<rect x="${cx + c * px}" y="${y0 + r * px}" width="${px}" height="${px}" fill="${color}"/>`;
        }
      }
    }
    cx += grid[0].length * px;
    if (i < str.length - 1) cx += px;
  }
  return out;
}

/** 4 brackets "L" aux coins */
function corners(size, bpx, pad, len, color, op) {
  let out = '';
  const push = (x, y) => {
    out += `<rect x="${x}" y="${y}" width="${bpx}" height="${bpx}" fill="${color}" opacity="${op}"/>`;
  };
  for (let i = 0; i < len; i++) {
    const L = pad, T = pad;
    const R = size - pad - bpx, B = size - pad - bpx;
    push(L,            T + i * bpx); push(L + i * bpx, T);
    push(R,            T + i * bpx); push(R - i * bpx, T);
    push(L,            B - i * bpx); push(L + i * bpx, B);
    push(R,            B - i * bpx); push(R - i * bpx, B);
  }
  return out;
}

/** Grille de micro-points décoratifs */
function dotGrid(size, dotPx, count, color, op) {
  const step = Math.floor(size / count);
  let out = '';
  for (let r = 1; r < count; r++) {
    for (let c = 1; c < count; c++) {
      const x = c * step - Math.floor(dotPx / 2);
      const y = r * step - Math.floor(dotPx / 2);
      out += `<rect x="${x}" y="${y}" width="${dotPx}" height="${dotPx}" fill="${color}" opacity="${op}"/>`;
    }
  }
  return out;
}

async function writePng(svgString, outPath) {
  await sharp(Buffer.from(svgString, 'utf8')).png().toFile(outPath);
  console.log('  ✅  ', path.basename(outPath));
}

// ─── icon.png (1024×1024) ────────────────────────────────────────────────────

async function generateIcon() {
  const S = 1024, PX = 64;
  const w = measureText('PN', PX);
  const h = 7 * PX;
  const x = Math.round((S - w) / 2);
  const y = Math.round((S - h) / 2);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${S}" height="${S}" fill="${BG}"/>
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="48%">
      <stop offset="0%"   stop-color="${RED}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${RED}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#g)"/>
  ${dotGrid(S, 4, 10, RED, 0.15)}
  <rect x="${x}" y="${y - PX}" width="${w}" height="${Math.round(PX / 4)}" fill="${RED}" opacity="0.9"/>
  <rect x="${x}" y="${y + h + Math.round(PX * 0.65)}" width="${w}" height="${Math.round(PX / 4)}" fill="${RED}" opacity="0.9"/>
  ${renderText('PN', x, y, PX, RED)}
  ${corners(S, Math.round(PX / 2), 52, 4, RED, 0.75)}
</svg>`;

  await writePng(svg, path.join(__dirname, '..', 'assets', 'icon.png'));
}

// ─── adaptive-icon.png (1024×1024) ───────────────────────────────────────────

async function generateAdaptiveIcon() {
  const S = 1024, PX = 56;
  const w = measureText('PN', PX);
  const h = 7 * PX;
  const x = Math.round((S - w) / 2);
  const y = Math.round((S - h) / 2);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${S}" height="${S}" fill="${BG}"/>
  <defs>
    <radialGradient id="g2" cx="50%" cy="50%" r="46%">
      <stop offset="0%"   stop-color="${RED}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${RED}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#g2)"/>
  <rect x="${x}" y="${y - PX}" width="${w}" height="${Math.round(PX / 4)}" fill="${RED}" opacity="0.9"/>
  <rect x="${x}" y="${y + h + Math.round(PX * 0.65)}" width="${w}" height="${Math.round(PX / 4)}" fill="${RED}" opacity="0.9"/>
  ${renderText('PN', x, y, PX, RED)}
  ${corners(S, Math.round(PX / 2), 72, 3, RED, 0.6)}
</svg>`;

  await writePng(svg, path.join(__dirname, '..', 'assets', 'adaptive-icon.png'));
}

// ─── splash-icon.png (2048×2048) ─────────────────────────────────────────────

async function generateSplash() {
  const S = 2048, PX = 48;

  const wPIXEL = measureText('PIXEL', PX);
  const wNIGHT = measureText('NIGHT', PX);
  const hLine  = 7 * PX;
  const gap    = PX * 3;

  // Centre vertical légèrement au-dessus du milieu géométrique
  const totalH = hLine * 2 + gap;
  const yPIXEL = Math.round((S - totalH) / 2) - PX * 3;
  const yNIGHT = yPIXEL + hLine + gap;

  const xPIXEL = Math.round((S - wPIXEL) / 2);
  const xNIGHT = Math.round((S - wNIGHT) / 2);

  // Ligne séparatrice
  const divMaxW = Math.max(wPIXEL, wNIGHT) + PX * 6;
  const divX    = Math.round((S - divMaxW) / 2);
  const divY    = yPIXEL + hLine + Math.round(gap / 2) - Math.round(PX / 6);

  // Sous-titre
  const subY = yNIGHT + hLine + PX * 4;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${S}" height="${S}" fill="${BG}"/>
  ${dotGrid(S, 5, 14, WHITE, 0.035)}
  <defs>
    <radialGradient id="sg" cx="50%" cy="50%" r="35%">
      <stop offset="0%"   stop-color="${RED}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${RED}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#sg)"/>
  ${renderText('PIXEL', xPIXEL, yPIXEL, PX, WHITE)}
  <rect x="${divX}" y="${divY}" width="${divMaxW}" height="${Math.round(PX / 3)}" fill="${RED}" opacity="0.85"/>
  ${renderText('NIGHT', xNIGHT, yNIGHT, PX, RED)}
  <text
    x="${S / 2}" y="${subY}"
    font-family="'Courier New', Courier, monospace"
    font-size="54" font-weight="bold"
    fill="${RED}" text-anchor="middle"
    letter-spacing="10" opacity="0.80"
  >DEVINE L&apos;IMAGE DU JOUR</text>
  ${corners(S, PX, 80, 4, RED, 0.35)}
</svg>`;

  await writePng(svg, path.join(__dirname, '..', 'assets', 'splash-icon.png'));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎨  Génération des assets PixelNight...\n');
  await Promise.all([generateIcon(), generateAdaptiveIcon(), generateSplash()]);
  console.log('\n✨  Terminé ! Relancez expo start pour voir les changements.\n');
}

main().catch((err) => {
  console.error('\n❌  Erreur :', err.message ?? err);
  process.exit(1);
});
