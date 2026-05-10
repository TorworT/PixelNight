/**
 * generate-store-assets.js
 * ────────────────────────────────────────────────────────────────────────────
 * Génère deux fichiers PNG pour le Play Store :
 *   assets/store/icon_512.png      — icône 512×512
 *   assets/store/banner_1024x500.png — bannière 1024×500
 *
 * Usage : node scripts/generate-store-assets.js
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

// ─── Palette ─────────────────────────────────────────────────────────────────
const BG        = { r: 15,  g: 15,  b: 26  };   // #0f0f1a
const WHITE     = { r: 255, g: 255, b: 255  };
const RED       = { r: 233, g: 69,  b: 96   };   // #e94560
const RED_DARK  = { r: 140, g: 28,  b: 48   };   // coins
const RED_DIM   = { r: 60,  g: 12,  b: 24   };   // coins intérieur

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Écrit un pixel RGBA dans un buffer Uint8Array (4 octets/pixel). */
function setPixel(buf, W, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= buf.length / 4 / W) return;
  const i = (y * W + x) * 4;
  buf[i]   = r;
  buf[i+1] = g;
  buf[i+2] = b;
  buf[i+3] = a;
}

/** Remplit un rectangle. */
function fillRect(buf, W, x, y, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(buf, W, x + dx, y + dy, r, g, b, a);
}

/** Peint une lettre bitmap (tableau de chaînes '0'/'1').
 *  cellSize = taille d'un « pixel » de la lettre en vrais pixels. */
function drawLetter(buf, W, bitmap, ox, oy, cellSize, r, g, b) {
  for (let row = 0; row < bitmap.length; row++) {
    for (let col = 0; col < bitmap[row].length; col++) {
      if (bitmap[row][col] === '1') {
        fillRect(buf, W,
          ox + col * cellSize,
          oy + row * cellSize,
          cellSize, cellSize,
          r, g, b);
      }
    }
  }
}

/** Dessine un cadre (épaisseur thick) autour de (x,y,w,h). */
function strokeRect(buf, W, x, y, w, h, thick, r, g, b) {
  fillRect(buf, W, x,           y,           w,     thick, r, g, b);
  fillRect(buf, W, x,           y + h-thick, w,     thick, r, g, b);
  fillRect(buf, W, x,           y,           thick, h,     r, g, b);
  fillRect(buf, W, x + w-thick, y,           thick, h,     r, g, b);
}

/** Décore les 4 coins avec un motif pixel gaming (L en pixel art). */
function drawCorners(buf, W, H, size, thick, r, g, b) {
  const S = size;
  const T = thick;
  // Coin supérieur gauche
  fillRect(buf, W, 0,     0,     S, T, r, g, b);
  fillRect(buf, W, 0,     0,     T, S, r, g, b);
  fillRect(buf, W, T*2,   T*2,   T, T, r, g, b);   // pixel intérieur

  // Coin supérieur droit
  fillRect(buf, W, W-S,   0,     S, T, r, g, b);
  fillRect(buf, W, W-T,   0,     T, S, r, g, b);
  fillRect(buf, W, W-T*3, T*2,   T, T, r, g, b);

  // Coin inférieur gauche
  fillRect(buf, W, 0,     H-T,   S, T, r, g, b);
  fillRect(buf, W, 0,     H-S,   T, S, r, g, b);
  fillRect(buf, W, T*2,   H-T*3, T, T, r, g, b);

  // Coin inférieur droit
  fillRect(buf, W, W-S,   H-T,   S, T, r, g, b);
  fillRect(buf, W, W-T,   H-S,   T, S, r, g, b);
  fillRect(buf, W, W-T*3, H-T*3, T, T, r, g, b);
}

// ─── Bitmaps des lettres (5×7, grille de bits) ───────────────────────────────

const GLYPHS = {
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
};

/** Mesure la largeur totale d'un mot avec cellSize et gap entre lettres. */
function wordWidth(word, cellSize, gap) {
  return word.length * 5 * cellSize + (word.length - 1) * gap;
}

/** Dessine un mot centré horizontalement. */
function drawWordCentered(buf, W, word, cy, cellSize, gap, r, g, b) {
  const totalW = wordWidth(word, cellSize, gap);
  let ox = Math.round((W - totalW) / 2);
  const H_ROWS = 7;
  const oy = Math.round(cy - (H_ROWS * cellSize) / 2);
  for (const ch of word) {
    const glyph = GLYPHS[ch];
    if (glyph) drawLetter(buf, W, glyph, ox, oy, cellSize, r, g, b);
    ox += 5 * cellSize + gap;
  }
}

// ─── 1. ICÔNE 512×512 ────────────────────────────────────────────────────────

async function generateIcon() {
  const W = 512, H = 512;
  const buf = Buffer.alloc(W * H * 4);

  // Fond
  fillRect(buf, W, 0, 0, W, H, BG.r, BG.g, BG.b);

  // Bordure intérieure fine
  strokeRect(buf, W, 8, 8, W - 16, H - 16, 2, RED_DARK.r, RED_DARK.g, RED_DARK.b);

  // ── Texte "PIXEL" (blanc, centré à ~38% hauteur) ─────────────────────────
  const CELL = 14;  // taille d'un pixel-lettre en vrais pixels
  const GAP  = 8;   // espace entre lettres
  drawWordCentered(buf, W, 'PIXEL', Math.round(H * 0.34), CELL, GAP,
    WHITE.r, WHITE.g, WHITE.b);

  // ── Ligne séparatrice rouge ───────────────────────────────────────────────
  const lineY = Math.round(H * 0.52);
  fillRect(buf, W, 48, lineY - 3, W - 96, 3, RED.r, RED.g, RED.b);
  // Petits pixels décoratifs aux extrémités
  fillRect(buf, W, 40,     lineY - 5, 5, 5, RED_DARK.r, RED_DARK.g, RED_DARK.b);
  fillRect(buf, W, W - 45, lineY - 5, 5, 5, RED_DARK.r, RED_DARK.g, RED_DARK.b);

  // ── Texte "NIGHT" (rouge, centré à ~68% hauteur) ─────────────────────────
  drawWordCentered(buf, W, 'NIGHT', Math.round(H * 0.67), CELL, GAP,
    RED.r, RED.g, RED.b);

  // ── Coins décoratifs ─────────────────────────────────────────────────────
  drawCorners(buf, W, H, 44, 8, RED_DARK.r, RED_DARK.g, RED_DARK.b);
  // Pixels intérieurs plus clairs
  setPixel(buf, W, 20, 20, RED.r, RED.g, RED.b);
  setPixel(buf, W, W - 21, 20, RED.r, RED.g, RED.b);
  setPixel(buf, W, 20, H - 21, RED.r, RED.g, RED.b);
  setPixel(buf, W, W - 21, H - 21, RED.r, RED.g, RED.b);

  const outPath = path.join(__dirname, '../assets/store/icon_512.png');
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(outPath);
  console.log('✓ icon_512.png');
}

// ─── 2. BANNIÈRE 1024×500 ────────────────────────────────────────────────────

async function generateBanner() {
  const W = 1024, H = 500;
  const buf = Buffer.alloc(W * H * 4);

  // Fond
  fillRect(buf, W, 0, 0, W, H, BG.r, BG.g, BG.b);

  // ── Zone logo (côté gauche, 0..440) ─────────────────────────────────────
  const LOGO_W = 440;

  // Fond légèrement plus clair pour la zone logo
  fillRect(buf, W, 12, 12, LOGO_W - 24, H - 24, 20, 20, 35);
  strokeRect(buf, W, 12, 12, LOGO_W - 24, H - 24, 2, RED_DARK.r, RED_DARK.g, RED_DARK.b);

  const CELL = 13, GAP = 7;

  // "PIXEL" centré dans la moitié gauche, ~38% hauteur
  const logoHalfW = LOGO_W;
  const pixelW    = wordWidth('PIXEL', CELL, GAP);
  const pixelOx   = Math.round((logoHalfW - pixelW) / 2);
  const pixelOy   = Math.round(H * 0.30) - Math.round(7 * CELL / 2);
  for (let ci = 0; ci < 'PIXEL'.length; ci++) {
    const g = GLYPHS['PIXEL'[ci]];
    drawLetter(buf, W, g, pixelOx + ci * (5 * CELL + GAP), pixelOy, CELL,
      WHITE.r, WHITE.g, WHITE.b);
  }

  // Ligne séparatrice rouge
  const lineY = Math.round(H * 0.52);
  fillRect(buf, W, 40, lineY - 2, LOGO_W - 80, 3, RED.r, RED.g, RED.b);
  fillRect(buf, W, 32,          lineY - 5, 6, 6, RED_DARK.r, RED_DARK.g, RED_DARK.b);
  fillRect(buf, W, LOGO_W - 38, lineY - 5, 6, 6, RED_DARK.r, RED_DARK.g, RED_DARK.b);

  // "NIGHT" centré dans la moitié gauche, ~68% hauteur
  const nightW  = wordWidth('NIGHT', CELL, GAP);
  const nightOx = Math.round((logoHalfW - nightW) / 2);
  const nightOy = Math.round(H * 0.67) - Math.round(7 * CELL / 2);
  for (let ci = 0; ci < 'NIGHT'.length; ci++) {
    const g = GLYPHS['NIGHT'[ci]];
    drawLetter(buf, W, g, nightOx + ci * (5 * CELL + GAP), nightOy, CELL,
      RED.r, RED.g, RED.b);
  }

  // Coins décoratifs zone logo
  const lc = (buf2, W2, x, y, size, thick) => {
    fillRect(buf2, W2, x,            y,            size, thick, RED_DARK.r, RED_DARK.g, RED_DARK.b);
    fillRect(buf2, W2, x,            y,            thick, size, RED_DARK.r, RED_DARK.g, RED_DARK.b);
  };
  lc(buf, W, 20, 20, 32, 6);
  // Top right of logo area
  fillRect(buf, W, LOGO_W - 52, 20, 32, 6,  RED_DARK.r, RED_DARK.g, RED_DARK.b);
  fillRect(buf, W, LOGO_W - 26, 20, 6, 32,  RED_DARK.r, RED_DARK.g, RED_DARK.b);
  // Bottom left
  fillRect(buf, W, 20, H - 26, 32, 6, RED_DARK.r, RED_DARK.g, RED_DARK.b);
  fillRect(buf, W, 20, H - 52, 6, 32, RED_DARK.r, RED_DARK.g, RED_DARK.b);
  // Bottom right of logo area
  fillRect(buf, W, LOGO_W - 52, H - 26, 32, 6, RED_DARK.r, RED_DARK.g, RED_DARK.b);
  fillRect(buf, W, LOGO_W - 26, H - 52, 6,  32, RED_DARK.r, RED_DARK.g, RED_DARK.b);

  // ── Séparateur vertical entre logo et zone pixels ──────────────────────
  fillRect(buf, W, LOGO_W, 20, 3, H - 40, RED_DARK.r, RED_DARK.g, RED_DARK.b);

  // ── Zone pixel art (côté droit, LOGO_W+16..W-16) ──────────────────────
  const PX_START_X = LOGO_W + 16;
  const PX_START_Y = 24;
  const PX_W       = W - PX_START_X - 16;
  const SUBTITLE_H = 100;       // réserve en bas pour le sous-titre (2 lignes × 42px + 6px + marges)
  const PX_H       = H - PX_START_Y - SUBTITLE_H - 12;
  const PIX_SIZE   = 18;        // taille d'un macro-pixel

  // Seed déterministe pour couleurs aléatoires reproductibles
  let seed = 0xA4B2C3;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0xFFFFFFFF;
  };

  // Palette : surtout sombres/désaturés, quelques accents pour simuler
  // une image de jeu pixelisée/floue. ~70% de teintes sombres.
  const PALETTE = [
    [15,  15,  26 ],  // noir BG
    [22,  22,  45 ],  // bleu nuit
    [35,  18,  35 ],  // violet très sombre
    [18,  35,  40 ],  // bleu-vert sombre
    [50,  25,  30 ],  // rouge très sombre
    [233, 69,  96 ],  // rouge PN  (accent)
    [140, 28,  48 ],  // rouge PN sombre
    [45,  55,  90 ],  // bleu moyen
    [60,  30,  70 ],  // violet moyen
    [30,  70,  60 ],  // vert sombre
    [180, 120, 50 ],  // or tamisé (rare)
    [100, 160, 200],  // bleu ciel (rare)
    [200, 190, 170],  // beige clair (rare)
    [80,  80,  80 ],  // gris
  ];

  // Probabilités : très majoritairement sombres
  const WEIGHTS = [0.20, 0.14, 0.12, 0.10, 0.10, 0.08, 0.07, 0.06, 0.05, 0.04, 0.01, 0.01, 0.01, 0.01];
  const cumWeights = [];
  let cum = 0;
  for (const w of WEIGHTS) { cum += w; cumWeights.push(cum); }

  const pickColor = () => {
    const r = rand();
    for (let i = 0; i < cumWeights.length; i++) {
      if (r < cumWeights[i]) return PALETTE[i];
    }
    return PALETTE[0];
  };

  // Dessine les macro-pixels
  const colsN  = Math.floor(PX_W / PIX_SIZE);
  const rowsN  = Math.floor(PX_H / PIX_SIZE);
  const gridOx = PX_START_X + Math.floor((PX_W - colsN * PIX_SIZE) / 2);
  const gridOy = PX_START_Y + Math.floor((PX_H - rowsN * PIX_SIZE) / 2);

  for (let row = 0; row < rowsN; row++) {
    for (let col = 0; col < colsN; col++) {
      const [pr, pg, pb] = pickColor();
      const px = gridOx + col * PIX_SIZE;
      const py = gridOy + row * PIX_SIZE;
      // Pixel principal
      fillRect(buf, W, px, py, PIX_SIZE - 1, PIX_SIZE - 1, pr, pg, pb);
      // Highlight top-left (clair)
      fillRect(buf, W, px, py, PIX_SIZE - 1, 1,
        Math.min(255, pr + 40), Math.min(255, pg + 40), Math.min(255, pb + 40));
      fillRect(buf, W, px, py, 1, PIX_SIZE - 1,
        Math.min(255, pr + 40), Math.min(255, pg + 40), Math.min(255, pb + 40));
      // Shadow bottom-right (sombre)
      fillRect(buf, W, px, py + PIX_SIZE - 2, PIX_SIZE - 1, 1,
        Math.max(0, pr - 30), Math.max(0, pg - 30), Math.max(0, pb - 30));
      fillRect(buf, W, px + PIX_SIZE - 2, py, 1, PIX_SIZE - 1,
        Math.max(0, pr - 30), Math.max(0, pg - 30), Math.max(0, pb - 30));
    }
  }

  // Cadre autour de la grille de pixels
  strokeRect(buf, W,
    gridOx - 3, gridOy - 3,
    colsN * PIX_SIZE + 6, rowsN * PIX_SIZE + 6,
    3, RED_DARK.r, RED_DARK.g, RED_DARK.b);

  // Coins du cadre pixel
  const fc = (cx, cy) => {
    fillRect(buf, W, cx, cy, 10, 3, RED.r, RED.g, RED.b);
    fillRect(buf, W, cx, cy, 3, 10, RED.r, RED.g, RED.b);
  };
  fc(gridOx - 6, gridOy - 6);
  fc(gridOx + colsN * PIX_SIZE - 4, gridOy - 6);
  fc(gridOx - 6, gridOy + rowsN * PIX_SIZE - 4);
  fc(gridOx + colsN * PIX_SIZE - 4, gridOy + rowsN * PIX_SIZE - 4);

  // ── Sous-titre "Devine l'image du jour" ──────────────────────────────────
  // On utilise de gros pixels (CELL=8) espacés pour le texte en bas à droite
  // Dessiné lettre par lettre avec un jeu de caractères étendu

  const EXTRA_GLYPHS = {
    D: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    V: ['10001', '10001', '10001', '01010', '01010', '00100', '00100'],
    A: ['00100', '01010', '10001', '11111', '10001', '10001', '10001'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],  // espace
    "'": ['011', '011', '010', '100', '000', '000', '000'],
    // On va utiliser uniquement les lettres disponibles
  };

  // Fusionner avec GLYPHS principal
  const ALL_G = { ...GLYPHS, ...EXTRA_GLYPHS };

  // Texte : "DEVINE L IMAGE DU JOUR" (apostrophes en 3 largeur)
  // On fait deux lignes pour tenir dans la zone
  const line1 = ['D', 'E', 'V', 'I', 'N', 'E'];
  const line2 = ['L', 'I', 'M', 'A', 'G', 'E', 'D', 'U', 'J', 'O', 'U', 'R'];

  // Ah, M et A ne sont pas dans GLYPHS. On les ajoute :
  const MORE = {
    M: ['10001', '11011', '10101', '10001', '10001', '10001', '10001'],
    A: ['00100', '01010', '10001', '11111', '10001', '10001', '10001'],
    C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    D: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    V: ['10001', '10001', '10001', '01010', '01010', '00100', '00100'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  };
  Object.assign(ALL_G, MORE);

  // Recalcule les 2 lignes
  const SUB_CELL = 6;
  const SUB_GAP  = 4;

  // Ligne 1 : "DEVINE"  Ligne 2 : "L IMAGE DU JOUR"
  const words1 = ['DEVINE'];
  const words2 = ['IMAGE', 'DU', 'JOUR'];

  const renderLine = (chars, y) => {
    const totalW2 = chars.length * 5 * SUB_CELL + (chars.length - 1) * SUB_GAP;
    // Aligner à droite dans la zone droite
    const startX = W - 24 - totalW2;
    for (let ci = 0; ci < chars.length; ci++) {
      const g = ALL_G[chars[ci]];
      if (!g) continue;
      const lx = startX + ci * (5 * SUB_CELL + SUB_GAP);
      drawLetter(buf, W, g, lx, y, SUB_CELL, RED.r, RED.g, RED.b);
    }
  };

  // Positionner le sous-titre dans la zone réservée en bas (fixe)
  // Ligne 1 : "DEVINE"  Ligne 2 : "IMAGE DU JOUR"
  // Chaque ligne fait 7 * SUB_CELL = 42px de haut
  const line1Y = H - SUBTITLE_H + 6;   // ancre dans la zone réservée
  const line2Y = line1Y + 7 * SUB_CELL + 6;
  renderLine(['D','E','V','I','N','E'], line1Y);
  renderLine(['I','M','A','G','E',' ','D','U',' ','J','O','U','R'], line2Y);

  // ── Coins décoratifs globaux (coins extérieurs de la bannière) ─────────
  drawCorners(buf, W, H, 48, 8, RED_DARK.r, RED_DARK.g, RED_DARK.b);

  const outPath = path.join(__dirname, '../assets/store/banner_1024x500.png');
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(outPath);
  console.log('✓ banner_1024x500.png');
}

// ─── Run ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await generateIcon();
    await generateBanner();
    console.log('\n✅  Fichiers créés dans assets/store/');
  } catch (err) {
    console.error('❌ Erreur :', err);
    process.exit(1);
  }
})();
