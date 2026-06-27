"""
upload_originals.py
Uploade les images originales manquantes vers Supabase Storage.

Usage :
    set SUPABASE_SERVICE_KEY=eyJhbGci...   (Windows)
    python upload_originals.py

    --dry-run   Simule sans uploader
"""

import os
import sys
from pathlib import Path

import requests

# ─── Configuration ────────────────────────────────────────────────────────────

SUPABASE_URL         = 'https://dbxrixboueetuditoxdz.supabase.co'
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

ROOT = Path(__file__).parent

# (chemin_local, bucket, chemin_dans_bucket)
ORIGINALS = [
    # ── games ──────────────────────────────────────────────────────────────────
    (ROOT / 'assets/images/2026/Jeux video/2026/mai/The Outer Worlds.jpg',      'games',  'mai/The Outer Worlds.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/juillet/ClashRoyale.jpg',       'games',  'juillet/ClashRoyale.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/juillet/CrashBandicoot.jpg',    'games',  'juillet/CrashBandicoot.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/juillet/Tetris.jpg',            'games',  'juillet/Tetris.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/septembre/HollowKnight.jpg',    'games',  'septembre/HollowKnight.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/septembre/SubwaySurfers.jpg',   'games',  'septembre/SubwaySurfers.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/septembre/Driver.jpg',          'games',  'septembre/Driver.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/septembre/CrazyTaxi.jpg',       'games',  'septembre/CrazyTaxi.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/octobre/JakAndDaxter.jpg',      'games',  'octobre/JakAndDaxter.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/octobre/MediEvil.jpg',          'games',  'octobre/MediEvil.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/novembre/TheDivision.jpg',      'games',  'novembre/TheDivision.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/novembre/Overwatch2.jpg',       'games',  'novembre/Overwatch2.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/novembre/Battlefield1.jpg',     'games',  'novembre/Battlefield1.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/novembre/R6.jpg',               'games',  'novembre/R6.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/decembre/Witcher3.jpg',         'games',  'decembre/Witcher3.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/decembre/FlightSim.jpg',        'games',  'decembre/FlightSim.jpg'),
    (ROOT / 'assets/images/2026/Jeux video/2026/decembre/ChuchuRocket.jpg',     'games',  'decembre/ChuchuRocket.jpg'),

    # ── anime ──────────────────────────────────────────────────────────────────
    (ROOT / 'assets/images/2026/Animé/2026/juin/BlackClover.jpg',               'anime',  'juin/BlackClover.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/juin/RurouniKenshin.jpg',            'anime',  'juin/RurouniKenshin.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/juin/Texhnolyze.jpg',               'anime',  'juin/Texhnolyze.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/juillet/JoJos Bizarre Adventure.jpg','anime',  'juillet/JoJos Bizarre Adventure.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/juillet/Elfen Lied.jpg',             'anime',  'juillet/Elfen Lied.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/juillet/Hellsing.jpg',               'anime',  'juillet/Hellsing.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/aout/MiraiNikki.jpg',               'anime',  'aout/MiraiNikki.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/aout/SoulEater.jpg',                'anime',  'aout/SoulEater.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/aout/MadeInAbyssMovie.jpg',         'anime',  'aout/MadeInAbyssMovie.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/aout/DevilPartTimer.jpg',           'anime',  'aout/DevilPartTimer.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/septembre/Nisekoi.jpg',             'anime',  'septembre/Nisekoi.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/septembre/SkipLoafer.jpg',          'anime',  'septembre/SkipLoafer.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/septembre/Sangatsu.jpg',            'anime',  'septembre/Sangatsu.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/octobre/Dorohedoro.jpg',            'anime',  'octobre/Dorohedoro.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/octobre/Fumetsu.jpg',               'anime',  'octobre/Fumetsu.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/octobre/ShieldHero.jpg',            'anime',  'octobre/ShieldHero.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/octobre/Bungo.jpg',                 'anime',  'octobre/Bungo.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/octobre/SoulEaterNot.jpg',          'anime',  'octobre/SoulEaterNot.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/novembre/Kaiji.jpg',                'anime',  'novembre/Kaiji.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/novembre/Toriko.jpg',               'anime',  'novembre/Toriko.jpg'),
    (ROOT / 'assets/images/2026/Animé/2026/novembre/Oregairu.jpg',             'anime',  'novembre/Oregairu.jpg'),

    # ── SerieTv ────────────────────────────────────────────────────────────────
    # TwoAndHalfMen et MidnightMass : décommenter une fois les fichiers ajoutés localement
    # (ROOT / 'assets/images/2026/SerieTv/2026/septembre/TwoAndHalfMen.jpg',  'SerieTv', 'septembre/TwoAndHalfMen.jpg'),
    # (ROOT / 'assets/images/2026/SerieTv/2026/novembre/MidnightMass.jpg',    'SerieTv', 'novembre/MidnightMass.jpg'),
]


# ─── Upload ───────────────────────────────────────────────────────────────────

import urllib.parse

def _url(bucket: str, path: str) -> str:
    encoded = '/'.join(urllib.parse.quote(seg, safe='') for seg in path.split('/'))
    return f'{SUPABASE_URL}/storage/v1/object/{bucket}/{encoded}'


def upload(bucket: str, path: str, data: bytes) -> tuple[bool, str]:
    try:
        r = requests.post(
            _url(bucket, path),
            headers={
                'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
                'Content-Type':  'image/jpeg',
                'x-upsert':      'true',
            },
            data=data,
            timeout=60,
        )
        if r.status_code in (200, 201):
            return True, ''
        return False, f'HTTP {r.status_code} - {r.text[:120]}'
    except requests.RequestException as e:
        return False, str(e)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    dry_run = '--dry-run' in sys.argv

    if not SUPABASE_SERVICE_KEY and not dry_run:
        print('Erreur : SUPABASE_SERVICE_KEY non défini.')
        print('  Windows : set SUPABASE_SERVICE_KEY=eyJhbGci...')
        sys.exit(1)

    if dry_run:
        print('Mode DRY-RUN — aucun upload effectué.\n')

    total  = len(ORIGINALS)
    ok     = 0
    errors = 0
    skip   = 0

    for i, (local_path, bucket, bucket_path) in enumerate(ORIGINALS, start=1):
        label = f'[{i:2}/{total}]  {bucket}/{bucket_path}'

        if not local_path.exists():
            print(f'{label}  SKIP (fichier local absent : {local_path})')
            skip += 1
            continue

        if dry_run:
            print(f'{label}  dry-run')
            continue

        data = local_path.read_bytes()
        success, errmsg = upload(bucket, bucket_path, data)

        if success:
            print(f'{label}  OK')
            ok += 1
        else:
            print(f'{label}  ERR {errmsg}')
            errors += 1

    print(f'\n{"─"*60}')
    if dry_run:
        print(f'DRY-RUN terminé — {total - skip} fichiers seraient uploadés, {skip} absents localement.')
    else:
        print(f'Terminé : {ok} OK  |  {errors} erreurs  |  {skip} absents localement')
    if errors:
        sys.exit(1)


if __name__ == '__main__':
    main()
