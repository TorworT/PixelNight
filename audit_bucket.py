"""
audit_bucket.py
Vérifie la cohérence entre daily_games et Supabase Storage.
Pour chaque entrée : image originale + _1 à _5 dans le bucket.
"""

import sys
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

SUPABASE_URL  = 'https://dbxrixboueetuditoxdz.supabase.co'
ANON_KEY      = (
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRieHJpeGJvdWVldHVkaXRveGR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjkzNzMsImV4cCI6MjA5MTg0NTM3M30.'
    'kMFwNFBplSdz-l5mlcfWE0ovq0e6Bs_17C8RoVMT1ns'
)
HEADERS = {'apikey': ANON_KEY, 'Authorization': f'Bearer {ANON_KEY}'}

ACTIVE_CATEGORIES = ['games', 'anime', 'dessinsanime', 'cinema', 'SerieTv']

# Mapping catégorie → bucket Storage
BUCKET = {
    'games':        'games',
    'anime':        'anime',
    'dessinsanime': 'dessinsanime',
    'cinema':       'cinema',
    'SerieTv':      'SerieTv',
}


# ─── Fetch all daily_games rows (paginated) ───────────────────────────────────

def fetch_all_rows() -> list[dict]:
    rows = []
    limit  = 1000
    offset = 0
    while True:
        r = requests.get(
            f'{SUPABASE_URL}/rest/v1/daily_games',
            params={
                'select': 'id,date,game_name,category,image_url',
                'order':  'date',
                'limit':  limit,
                'offset': offset,
            },
            headers=HEADERS,
            timeout=15,
        )
        r.raise_for_status()
        batch = r.json()
        rows.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return rows


# ─── Storage HEAD check ───────────────────────────────────────────────────────

def storage_url(bucket: str, path: str) -> str:
    encoded = '/'.join(urllib.parse.quote(seg, safe='') for seg in path.split('/'))
    return f'{SUPABASE_URL}/storage/v1/object/public/{bucket}/{encoded}'


def head_exists(url: str) -> bool:
    try:
        r = requests.head(url, timeout=8)
        return r.status_code == 200
    except requests.RequestException:
        return False


# ─── Build check tasks ────────────────────────────────────────────────────────

def build_tasks(rows: list[dict]) -> list[tuple]:
    """
    Retourne une liste de (row, suffix, url) à vérifier.
    suffix = '' pour l'original, '_1'…'_5' pour les pixelisées.
    """
    tasks = []
    for row in rows:
        cat = row['category']
        if cat not in ACTIVE_CATEGORIES:
            continue
        bucket   = BUCKET.get(cat, cat)
        img_url  = row['image_url']

        # Détermine le stem et l'extension
        lower = img_url.lower()
        if lower.endswith('.jpg'):
            stem = img_url[:-4]
            ext  = '.jpg'
        elif lower.endswith('.jpeg'):
            stem = img_url[:-5]
            ext  = '.jpeg'
        elif lower.endswith('.png'):
            stem = img_url[:-4]
            ext  = '.png'
        else:
            stem = img_url
            ext  = ''

        # Image originale
        tasks.append((row, 'original', storage_url(bucket, img_url)))

        # Versions pixelisées (_1 à _5) — toujours .jpg d'après pixelize_and_upload.py
        for i in range(1, 6):
            pixel_path = f'{stem}_{i}.jpg'
            tasks.append((row, f'_{i}', storage_url(bucket, pixel_path)))

    return tasks


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print('Récupération des entrées daily_games...')
    rows = fetch_all_rows()
    active = [r for r in rows if r['category'] in ACTIVE_CATEGORIES]
    print(f'{len(rows)} entrées totales, {len(active)} dans les catégories actives\n')

    tasks = build_tasks(active)
    print(f'{len(tasks)} fichiers à vérifier ({len(active)} × 6)...\n')

    # HEAD requests parallèles (32 workers)
    results: dict[tuple, bool] = {}
    with ThreadPoolExecutor(max_workers=32) as pool:
        future_map = {
            pool.submit(head_exists, url): (row, suffix, url)
            for row, suffix, url in tasks
        }
        done = 0
        for future in as_completed(future_map):
            row, suffix, url = future_map[future]
            exists = future.result()
            results[(row['id'], suffix)] = (row, suffix, url, exists)
            done += 1
            if done % 200 == 0:
                print(f'  ... {done}/{len(tasks)} vérifiés')

    # ─── Rapport ─────────────────────────────────────────────────────────────
    problems: list[tuple] = []
    for (row_id, suffix), (row, suffix, url, exists) in results.items():
        if not exists:
            problems.append((row, suffix, url))

    # Trie par date puis catégorie
    problems.sort(key=lambda x: (x[0]['date'], x[0]['category'], x[1]))

    if not problems:
        print('Aucune incohérence détectée.')
        return

    print(f'\n{"="*70}')
    print(f'INCOHÉRENCES TROUVÉES : {len(problems)} fichiers manquants')
    print(f'{"="*70}\n')

    # Groupe par entrée daily_games
    by_row: dict[str, list] = {}
    for row, suffix, url in problems:
        key = row['id']
        by_row.setdefault(key, {'row': row, 'missing': []})
        by_row[key]['missing'].append(suffix)

    orig_missing  = 0
    pixel_missing = 0
    both_missing  = 0

    for entry in by_row.values():
        row     = entry['row']
        missing = entry['missing']
        has_orig   = 'original' in missing
        has_pixels = any(s.startswith('_') for s in missing)

        tag = ''
        if has_orig and has_pixels:
            tag = '[ORIG+PIX]'
            both_missing += 1
        elif has_orig:
            tag = '[ORIG]    '
            orig_missing += 1
        else:
            tag = '[PIX]     '
            pixel_missing += 1

        missing_str = ', '.join(missing)
        print(f'{tag} {row["date"]}  {row["category"]:12s}  {row["game_name"]:30s}  {row["image_url"]}')
        print(f'           manquants : {missing_str}')
        print()

    print(f'{"="*70}')
    print(f'Résumé :')
    print(f'  Entrées avec image originale manquante uniquement : {orig_missing}')
    print(f'  Entrées avec pixelisées manquantes uniquement     : {pixel_missing}')
    print(f'  Entrées avec TOUT manquant (orig + pixelisées)    : {both_missing}')
    print(f'  Total entrées affectées                           : {len(by_row)}')
    print(f'  Total fichiers manquants                          : {len(problems)}')


if __name__ == '__main__':
    main()
