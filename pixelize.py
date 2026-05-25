"""
pixelize.py — Génère des versions pixelisées d'une image.

Usage :
    python pixelize.py <image_path> [tailles...]

    Exemple (tailles par défaut) :
        python pixelize.py assets/images/2026/Jeux\ video/2026/Août/GangBeasts.jpg

    Exemple avec tailles personnalisées :
        python pixelize.py mon_image.jpg 8 16 32 64

Méthode :
    Downscale avec Image.NEAREST → upscale vers la taille originale avec Image.NEAREST.
    Le nom des fichiers générés suit le pattern <stem>_1.jpg, <stem>_2.jpg, etc.
"""

import sys
from pathlib import Path
from PIL import Image

# ─── Tailles de bloc par défaut ───────────────────────────────────────────────
DEFAULT_BLOCK_SIZES = [16, 24, 40, 60, 90]


def pixelize(src: Path, block_sizes: list[int]) -> None:
    img = Image.open(src).convert("RGB")
    w, h = img.size
    print(f"Image source : {src.name}  ({w}×{h})")

    for i, block in enumerate(block_sizes, start=1):
        # Taille réduite (arrondie au pixel supérieur pour éviter les 0)
        small_w = max(1, w // block)
        small_h = max(1, h // block)

        pixelized = (
            img
            .resize((small_w, small_h), Image.NEAREST)   # réduction nette
            .resize((w, h),             Image.NEAREST)   # agrandissement → blocs visibles
        )

        out_path = src.parent / f"{src.stem}_{i}{src.suffix}"
        pixelized.save(out_path, quality=92)
        print(f"  [{i}] bloc {block:>3}px  ->  {out_path.name}")

    print("Terminé.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage : python pixelize.py <image_path> [taille1 taille2 ...]")
        sys.exit(1)

    src = Path(sys.argv[1])
    if not src.exists():
        print(f"Erreur : fichier introuvable → {src}")
        sys.exit(1)

    sizes = [int(x) for x in sys.argv[2:]] if len(sys.argv) > 2 else DEFAULT_BLOCK_SIZES
    pixelize(src, sizes)
