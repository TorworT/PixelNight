/**
 * generate-buttons.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Génère les boutons PNG pixel-art via SVG → sharp.
 * Usage : node scripts/generate-buttons.js
 */

const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');

const OUT_DIR = path.join(__dirname, '../assets/images/buttons');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Palette ─────────────────────────────────────────────────────────────────
const RED        = '#e94560';
const RED_DARK   = '#a02030';   // ombre bas/droite
const RED_LIGHT  = '#f07080';   // highlight haut/gauche
const RED_DIM    = '#3a0f18';   // fond very dark pour secondary
const WHITE      = '#ffffff';
const TRANSPARENT = 'none';

// ─── Dimensions ──────────────────────────────────────────────────────────────
const W = 300, H = 80;
const SHADOW = 4;               // décalage ombre pixel
const BORDER = 2;               // épaisseur bordure

// ─── SVG builder ─────────────────────────────────────────────────────────────

/**
 * Génère le SVG d'un bouton.
 * @param {string} label       — texte affiché (peut être vide)
 * @param {'primary'|'secondary'} variant
 */
function buildSVG(label, variant = 'primary') {
  const isPrimary   = variant === 'primary';
  const bgFill      = isPrimary ? RED        : 'transparent';
  const borderColor = isPrimary ? RED_LIGHT  : RED;
  const shadowColor = RED_DARK;
  const textColor   = WHITE;

  // Taille du corps du bouton (sans l'ombre)
  const bW = W - SHADOW;
  const bH = H - SHADOW;

  // Taille de police adaptive selon longueur du label
  const charCount  = label.length || 1;
  const maxFontPx  = 22;
  const minFontPx  = 11;
  // Largeur approximative d'un glyphe monospace uppercase ≈ 0.65× font-size
  const rawFont    = Math.floor((bW - 32) / (charCount * 0.65));
  const fontSize   = Math.min(maxFontPx, Math.max(minFontPx, rawFont));
  // letter-spacing réduit pour éviter que les espaces entre mots soient trop larges
  const letterSpacing = fontSize >= 18 ? 2 : 1;

  // ── Pixels décoratifs aux coins (pixel-art corners) ───────────────────────
  // Chaque coin = 3 petits carrés de 3px formant un L
  const P = 3;   // taille d'un pixel-coin
  const cornerColor = isPrimary ? RED_LIGHT : RED;
  const corners = `
    <!-- coin haut-gauche -->
    <rect x="${BORDER}"       y="${BORDER}"       width="${P}" height="${P}" fill="${cornerColor}" opacity="0.9"/>
    <rect x="${BORDER + P}"   y="${BORDER}"       width="${P}" height="${P}" fill="${cornerColor}" opacity="0.5"/>
    <rect x="${BORDER}"       y="${BORDER + P}"   width="${P}" height="${P}" fill="${cornerColor}" opacity="0.5"/>

    <!-- coin haut-droit -->
    <rect x="${bW - BORDER - P}"       y="${BORDER}"     width="${P}" height="${P}" fill="${cornerColor}" opacity="0.9"/>
    <rect x="${bW - BORDER - P*2}"     y="${BORDER}"     width="${P}" height="${P}" fill="${cornerColor}" opacity="0.5"/>
    <rect x="${bW - BORDER - P}"       y="${BORDER + P}" width="${P}" height="${P}" fill="${cornerColor}" opacity="0.5"/>

    <!-- coin bas-gauche -->
    <rect x="${BORDER}"     y="${bH - BORDER - P}"   width="${P}" height="${P}" fill="${cornerColor}" opacity="0.9"/>
    <rect x="${BORDER + P}" y="${bH - BORDER - P}"   width="${P}" height="${P}" fill="${cornerColor}" opacity="0.5"/>
    <rect x="${BORDER}"     y="${bH - BORDER - P*2}" width="${P}" height="${P}" fill="${cornerColor}" opacity="0.5"/>

    <!-- coin bas-droit -->
    <rect x="${bW - BORDER - P}"   y="${bH - BORDER - P}"   width="${P}" height="${P}" fill="${cornerColor}" opacity="0.9"/>
    <rect x="${bW - BORDER - P*2}" y="${bH - BORDER - P}"   width="${P}" height="${P}" fill="${cornerColor}" opacity="0.5"/>
    <rect x="${bW - BORDER - P}"   y="${bH - BORDER - P*2}" width="${P}" height="${P}" fill="${cornerColor}" opacity="0.5"/>
  `;

  // ── Gradient interne (léger) pour donner du relief ─────────────────────────
  const gradientId = `g${Math.random().toString(36).slice(2)}`;
  const gradientDef = isPrimary ? `
    <defs>
      <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.08"/>
        <stop offset="50%"  stop-color="#ffffff" stop-opacity="0.00"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.10"/>
      </linearGradient>
    </defs>
  ` : '';

  const gradientOverlay = isPrimary
    ? `<rect x="0" y="0" width="${bW}" height="${bH}" fill="url(#${gradientId})"/>`
    : '';

  // ── Highlight top (1px clair) ─────────────────────────────────────────────
  const highlight = isPrimary
    ? `<rect x="${BORDER}" y="${BORDER}" width="${bW - BORDER * 2}" height="1" fill="${RED_LIGHT}" opacity="0.5"/>`
    : '';

  // ── Corps du bouton ───────────────────────────────────────────────────────
  // L'ombre n'est rendue que pour le variant primary (le secondary est transparent)
  const shadowEl = isPrimary
    ? `<rect x="${SHADOW}" y="${SHADOW}" width="${bW}" height="${bH}" fill="${shadowColor}"/>`
    : `<rect x="${SHADOW}" y="${SHADOW}" width="${bW}" height="${bH}"
             fill="none" stroke="${RED_DARK}" stroke-width="${BORDER}"/>`;

  const body = `
    <!-- ombre décalée bas-droite -->
    ${shadowEl}

    <!-- corps principal -->
    <rect x="0" y="0" width="${bW}" height="${bH}"
          fill="${bgFill}"
          stroke="${borderColor}"
          stroke-width="${BORDER}"/>

    ${gradientDef}
    ${gradientOverlay}
    ${highlight}
    ${corners}
  `;

  // ── Texte ─────────────────────────────────────────────────────────────────
  // On utilise une police monospace système pour le look pixel-art
  const textEl = label ? `
    <text
      x="${bW / 2}"
      y="${bH / 2 + fontSize * 0.38}"
      text-anchor="middle"
      font-family="'Courier New', 'Lucida Console', monospace"
      font-size="${fontSize}"
      font-weight="900"
      letter-spacing="${letterSpacing}"
      fill="${textColor}"
    >${label}</text>

    <!-- ombre texte 1px bas-droite -->
    <text
      x="${bW / 2 + 1}"
      y="${bH / 2 + fontSize * 0.38 + 1}"
      text-anchor="middle"
      font-family="'Courier New', 'Lucida Console', monospace"
      font-size="${fontSize}"
      font-weight="900"
      letter-spacing="${letterSpacing}"
      fill="${RED_DARK}"
      opacity="0.6"
    >${label}</text>
  ` : '';

  // ── Assemblage SVG ────────────────────────────────────────────────────────
  // Le SVG a la taille totale (W×H), le corps du bouton est décalé de 0,0
  // et l'ombre est décalée de SHADOW,SHADOW
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${body}
    ${textEl}
  </svg>`;
}

// ─── Boutons à générer ───────────────────────────────────────────────────────

const BUTTONS = [
  { file: 'button_play.png',      label: 'JOUER',           variant: 'primary'   },
  { file: 'button_login.png',     label: 'SE CONNECTER',    variant: 'primary'   },
  { file: 'button_register.png',  label: 'CREER MON COMPTE',variant: 'primary'   },
  { file: 'button_primary.png',   label: '',                 variant: 'primary'   },
  { file: 'button_secondary.png', label: '',                 variant: 'secondary' },
];

// ─── Génération ──────────────────────────────────────────────────────────────

(async () => {
  for (const btn of BUTTONS) {
    const svg = buildSVG(btn.label, btn.variant);
    const outPath = path.join(OUT_DIR, btn.file);

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outPath);

    console.log(`✓  ${btn.file}`);
  }
  console.log(`\n✅  ${BUTTONS.length} boutons créés dans assets/images/buttons/`);
})().catch((err) => { console.error('❌', err); process.exit(1); });
