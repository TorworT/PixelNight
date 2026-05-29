"""
pixelize_and_upload.py
Genere 5 versions pixelisees de chaque image et les uploade sur Supabase Storage.

Usage :
    set SUPABASE_SERVICE_KEY=eyJhbGci...   (Windows)
    python pixelize_and_upload.py

    --dry-run   Simule sans generer ni uploader
    --no-skip   Retraite meme si deja present dans le bucket
"""

import io
import os
import re
import sys
import time
import unicodedata
import urllib.parse
from pathlib import Path

import requests
from PIL import Image

# ─── Configuration ────────────────────────────────────────────────────────────

SUPABASE_URL         = 'https://dbxrixboueetuditoxdz.supabase.co'
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

ROOT = Path(__file__).parent

# Dossiers sources exacts → bucket cible
SOURCES = [
    (ROOT / 'assets/images/2026/Jeux video/2026',   'games'),
    (ROOT / 'assets/images/2026/Dessin animé/2026',  'dessinsanime'),
    (ROOT / 'assets/images/2026/Animé/2026',          'anime'),
    (ROOT / 'assets/images/2026/Cinema',               'cinema'),
]

# Blocs de pixelisation : index 0 → _1 (tres pixelise), index 4 → _5 (presque net)
BLOCK_SIZES = [90, 60, 40, 24, 16]

# Regex : detecte un suffixe _1 a _5 avant l'extension (fichier deja pixelise)
_SUFFIX_RE = re.compile(r'_[1-5]$')


# ─── Normalisation du nom de dossier mois ─────────────────────────────────────

def normalize_folder(name: str) -> str:
    """
    Transforme un nom de dossier en chemin bucket :
      Aout    -> aout
      aout    -> aout
    """
    nfd = unicodedata.normalize('NFD', name)
    ascii_bytes = nfd.encode('ascii', 'ignore')
    return ascii_bytes.decode('ascii').lower()


# ─── Supabase Storage ─────────────────────────────────────────────────────────

def _headers(content_type: str | None = None) -> dict:
    h = {'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'}
    if content_type:
        h['Content-Type'] = content_type
    return h


def _url(bucket: str, path: str) -> str:
    """Construit l'URL Supabase Storage en encodant les caracteres speciaux."""
    encoded = '/'.join(urllib.parse.quote(seg, safe='') for seg in path.split('/'))
    return f'{SUPABASE_URL}/storage/v1/object/{bucket}/{encoded}'


def exists_in_bucket(bucket: str, path: str) -> bool:
    try:
        r = requests.head(_url(bucket, path), headers=_headers(), timeout=10)
        return r.status_code == 200
    except requests.RequestException:
        return False


def upload(bucket: str, path: str, data: bytes) -> tuple[bool, str]:
    try:
        r = requests.post(
            _url(bucket, path),
            headers=_headers('image/jpeg'),
            data=data,
            timeout=60,
        )
        if r.status_code in (200, 201):
            return True, ''
        return False, f'HTTP {r.status_code} - {r.text[:100]}'
    except requests.RequestException as e:
        return False, str(e)


# ─── Pixelisation ─────────────────────────────────────────────────────────────

def pixelize(img: Image.Image, block: int) -> bytes:
    """Retourne les bytes JPEG de l'image pixelisee avec des blocs de `block` px."""
    w, h = img.size
    small = img.resize((max(1, w // block), max(1, h // block)), Image.NEAREST)
    out   = small.resize((w, h), Image.NEAREST)
    buf   = io.BytesIO()
    out.save(buf, format='JPEG', quality=92)
    return buf.getvalue()


# ─── Collecte ─────────────────────────────────────────────────────────────────

def collect(category_filter: str | None = None) -> list[tuple[Path, str, str]]:
    """
    Retourne la liste de toutes les images sources :
      (chemin_local, bucket, chemin_base_dans_bucket)

    chemin_base = mois_normalise/NomFichier.jpg
    ex : (…/Août/BanjoTooie.jpg, 'games', 'aout/BanjoTooie.jpg')

    Deduplique par stem (prefere .jpg sur .png si les deux existent).
    Si category_filter est fourni, seul le bucket correspondant est traite.
    """
    tasks: list[tuple[Path, str, str]] = []
    seen:  set[tuple[str, str]] = set()

    for src_root, bucket in SOURCES:
        if category_filter and bucket != category_filter:
            continue
        if not src_root.exists():
            print(f'[!] Dossier introuvable, ignore : {src_root}')
            continue

        for f in sorted(src_root.rglob('*')):
            if f.suffix.lower() not in ('.jpg', '.jpeg', '.png'):
                continue
            if _SUFFIX_RE.search(f.stem):
                continue   # deja une version pixelisee

            # Mois = dossier parent direct dans src_root (ex: "Août")
            month_raw = f.parent.name
            month_key = normalize_folder(month_raw)

            # Chemin base dans le bucket : aout/BanjoTooie.jpg
            base_path = f'{month_key}/{f.stem}.jpg'

            key = (bucket, base_path)
            if key in seen:
                continue   # doublon jpg/png meme stem
            seen.add(key)

            tasks.append((f, bucket, base_path))

    return tasks


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    dry_run  = '--dry-run'  in sys.argv
    no_skip  = '--no-skip'  in sys.argv

    # --category <nom> : traite uniquement le bucket correspondant (ex: cinema, games, anime)
    category_filter: str | None = None
    if '--category' in sys.argv:
        idx = sys.argv.index('--category')
        if idx + 1 >= len(sys.argv):
            print('Erreur : --category requiert un argument (ex: --category cinema).')
            sys.exit(1)
        category_filter = sys.argv[idx + 1]
        valid = [bucket for _, bucket in SOURCES]
        if category_filter not in valid:
            print(f'Erreur : categorie inconnue "{category_filter}". Valeurs valides : {", ".join(valid)}')
            sys.exit(1)

    if not SUPABASE_SERVICE_KEY:
        print('Erreur : SUPABASE_SERVICE_KEY non defini.')
        print('  Windows : set SUPABASE_SERVICE_KEY=eyJhbGci...')
        print('  Unix    : export SUPABASE_SERVICE_KEY=eyJhbGci...')
        sys.exit(1)

    if dry_run:
        print('Mode DRY-RUN - aucune image generee ni uploadee.\n')
    if category_filter:
        print(f'Filtre actif : categorie "{category_filter}" uniquement.\n')

    print('Collecte des images...')
    tasks = collect(category_filter)
    total = len(tasks) * 5
    print(f'{len(tasks)} images sources -> {total} fichiers\n')

    counter = 0
    skipped = 0
    errors  = 0
    t0      = time.time()

    for src_path, bucket, base_path in tasks:
        try:
            img = Image.open(src_path).convert('RGB')
        except Exception as e:
            for _ in range(5):
                counter += 1
                errors  += 1
            print(f'  ERR lecture {src_path.name} - {e}')
            continue

        stem = base_path[:-4]   # retire ".jpg"

        for i, block in enumerate(BLOCK_SIZES, start=1):
            counter += 1
            versioned = f'{stem}_{i}.jpg'
            filename  = Path(versioned).name

            # -- Skip si deja dans le bucket --
            if not dry_run and not no_skip and exists_in_bucket(bucket, versioned):
                print(f'  [{counter:4}/{total}] {filename:45s} -> {bucket}/{versioned} (skip)')
                skipped += 1
                continue

            if dry_run:
                print(f'  [{counter:4}/{total}] {filename:45s} -> {bucket}/{versioned} (dry-run)')
                continue

            data       = pixelize(img, block)
            ok, errmsg = upload(bucket, versioned, data)

            if ok:
                print(f'  [{counter:4}/{total}] {filename:45s} -> {bucket}/{versioned} OK')
            else:
                errors += 1
                print(f'  [{counter:4}/{total}] {filename:45s} -> {bucket}/{versioned} ERR {errmsg}')

    elapsed = time.time() - t0
    print(f'\n------------------------------------------------------')
    print(f'Termine en {elapsed:.0f}s')
    print(f'  Uploades : {counter - skipped - errors}')
    print(f'  Skippes  : {skipped}')
    print(f'  Erreurs  : {errors}')
    if errors:
        sys.exit(1)


if __name__ == '__main__':
    main()
