/**
 * generate-icons.js
 * Generates icon.png + adaptive-icon.png (1024×1024) with pixel-art "PN" logo.
 *
 * Run from project root:
 *   node scripts/generate-icons.js
 */

const sharp = require('sharp');
const path  = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────

const SIZE    = 1024;
const BG      = { r: 15,  g: 15,  b: 26  };   // #0f0f1a
const FG      = { r: 233, g: 69,  b: 96  };   // #e94560
const GLOW    = { r: 233, g: 69,  b: 96  };

// 35% padding each side horizontally → content width = 30% of 1024 = ~307 px
// GAP_CELLS = 1  (letters closer together per request)
// 11 total columns → CELL = 307 / 11 ≈ 28 px
// Vertical: 7 rows × 28 = 196 px → ~40% padding top/bottom (natural for wide letters)
const CELL      = 28;   // px per pixel-art cell
const GAP_CELLS = 1;    // 1 empty cell between P and N (closer together)
const PIX_PAD   = 2;    // inner gap — proportional to smaller cell size

// ─── Pixel-art letter bitmaps (5 cols × 7 rows) ───────────────────────────────

const LETTER_P = [
  [1,1,1,1,0],
  [1,0,0,1,0],
  [1,0,0,1,0],
  [1,1,1,1,0],
  [1,0,0,0,0],
  [1,0,0,0,0],
  [1,0,0,0,0],
];

const LETTER_N = [
  [1,0,0,0,1],
  [1,1,0,0,1],
  [1,1,0,0,1],
  [1,0,1,0,1],
  [1,0,0,1,1],
  [1,0,0,1,1],
  [1,0,0,0,1],
];

// ─── Layout calculations ──────────────────────────────────────────────────────

const LETTER_W = 5;
const LETTER_H = 7;
const TOTAL_W  = (LETTER_W + GAP_CELLS + LETTER_W) * CELL;   // 11 * 28 = 308
const TOTAL_H  = LETTER_H * CELL;                             //  7 * 28 = 196
const OFF_X    = Math.floor((SIZE - TOTAL_W) / 2);
const OFF_Y    = Math.floor((SIZE - TOTAL_H) / 2);

// ─── Buffer helpers ───────────────────────────────────────────────────────────

const buf = Buffer.alloc(SIZE * SIZE * 4);

/** Fill buffer with background color */
function fillBackground() {
  for (let i = 0; i < SIZE * SIZE; i++) {
    const o = i * 4;
    buf[o]   = BG.r;
    buf[o+1] = BG.g;
    buf[o+2] = BG.b;
    buf[o+3] = 255;
  }
}

/** Alpha-blend a single pixel */
function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const o   = (y * SIZE + x) * 4;
  const src = a / 255;
  const dst = 1 - src;
  buf[o]   = Math.round(buf[o]   * dst + r * src);
  buf[o+1] = Math.round(buf[o+1] * dst + g * src);
  buf[o+2] = Math.round(buf[o+2] * dst + b * src);
  buf[o+3] = 255;
}

/** Fill a rectangle with alpha blending */
function fillRect(x1, y1, x2, y2, r, g, b, a = 255) {
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      setPixel(x, y, r, g, b, a);
}

// ─── Background decoration ────────────────────────────────────────────────────

/**
 * Extremely subtle dot-grid (32 px pitch) to give a pixel-art board feel.
 * Barely visible — just adds texture without competing with the logo.
 */
function drawGrid() {
  const PITCH = 32;
  for (let y = 0; y < SIZE; y += PITCH) {
    for (let x = 0; x < SIZE; x += PITCH) {
      // 1×1 slightly lighter dot
      setPixel(x, y, 28, 28, 48, 255);
    }
  }
}

// ─── Letter renderer ──────────────────────────────────────────────────────────

function drawLetter(bitmap, colOffset) {
  for (let row = 0; row < bitmap.length; row++) {
    for (let col = 0; col < bitmap[row].length; col++) {
      if (!bitmap[row][col]) continue;

      const cx = OFF_X + (colOffset + col) * CELL;
      const cy = OFF_Y + row * CELL;

      // Outer glow (diffuse, low opacity) — scaled to cell size
      fillRect(cx - 4, cy - 4, cx + CELL + 3, cy + CELL + 3,
               GLOW.r, GLOW.g, GLOW.b, 18);

      // Mid glow (tighter)
      fillRect(cx - 1, cy - 1, cx + CELL, cy + CELL,
               GLOW.r, GLOW.g, GLOW.b, 30);

      // Main pixel block (inset by PIX_PAD to create the gap between blocks)
      fillRect(cx + PIX_PAD, cy + PIX_PAD,
               cx + CELL - PIX_PAD - 1, cy + CELL - PIX_PAD - 1,
               FG.r, FG.g, FG.b, 255);

      // Highlight — top-left corner bright strip (gives 3D depth)
      fillRect(cx + PIX_PAD, cy + PIX_PAD,
               cx + CELL - PIX_PAD - 1, cy + PIX_PAD + 1,
               255, 160, 180, 55);
      fillRect(cx + PIX_PAD, cy + PIX_PAD,
               cx + PIX_PAD + 1, cy + CELL - PIX_PAD - 1,
               255, 160, 180, 30);

      // Shadow — bottom-right edge (darker)
      fillRect(cx + PIX_PAD, cy + CELL - PIX_PAD - 2,
               cx + CELL - PIX_PAD - 1, cy + CELL - PIX_PAD - 1,
               120, 20, 40, 80);
      fillRect(cx + CELL - PIX_PAD - 2, cy + PIX_PAD,
               cx + CELL - PIX_PAD - 1, cy + CELL - PIX_PAD - 1,
               120, 20, 40, 60);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function generate() {
  fillBackground();
  drawGrid();
  drawLetter(LETTER_P, 0);
  drawLetter(LETTER_N, LETTER_W + GAP_CELLS);

  const opts   = { raw: { width: SIZE, height: SIZE, channels: 4 } };
  const assets = path.join(__dirname, '..', 'assets');

  await sharp(buf, opts).png({ compressionLevel: 9 }).toFile(path.join(assets, 'icon.png'));
  console.log('✓ assets/icon.png');

  await sharp(buf, opts).png({ compressionLevel: 9 }).toFile(path.join(assets, 'adaptive-icon.png'));
  console.log('✓ assets/adaptive-icon.png');

  console.log(`\nLetter area : ${TOTAL_W} × ${TOTAL_H} px`);
  console.log(`Canvas fill : ${Math.round(TOTAL_W / SIZE * 100)}% wide × ${Math.round(TOTAL_H / SIZE * 100)}% tall`);
  console.log(`Offset      : left ${OFF_X} px, top ${OFF_Y} px`);
}

generate().catch(err => { console.error(err); process.exit(1); });
