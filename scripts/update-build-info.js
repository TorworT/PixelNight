#!/usr/bin/env node
/**
 * update-build-info.js
 * ────────────────────────────────────────────────────────────────────────────
 * Écrit la date/heure actuelle dans src/lib/buildInfo.ts.
 *
 * Utilisations :
 *   • Manuellement    : npm run build:info
 *   • Automatiquement : exécuté par `eas build` via prebuildCommand dans eas.json
 *
 * Permet de comparer exactement quelle version est chargée dans Expo Go vs APK.
 */

const fs   = require('fs');
const path = require('path');

const outPath = path.resolve(__dirname, '../src/lib/buildInfo.ts');
const now     = new Date().toISOString();

const content = `// ⚠️  Fichier auto-généré — ne pas modifier manuellement.
// Régénère avec : npm run build:info
// Exécuté automatiquement par \`eas build\` via le champ prebuildCommand dans eas.json.
// eslint-disable-next-line
export const BUILD_DATE_ISO = '${now}';
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('[build-info] BUILD_DATE_ISO =', now);
console.log('[build-info] Écrit dans     ', outPath);
