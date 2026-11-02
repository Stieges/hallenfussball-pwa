#!/usr/bin/env bash
#
# pdf-font-subset.sh — erzeugt die eingebettete PDF-Schrift neu (C-PDF-SCHRIFT-OHNE-MERKMALE, @DR-001, @DR-014).
#
# jsPDF setzt Text Zeichen für Zeichen ohne OpenType-Verarbeitung. Deshalb werden die Merkmale fest in die Schrift
# gebacken (Feature-Freeze: die cmap zeigt auf die Glyphen, die das Merkmal einsetzt), bevor sie auf unsere Abdeckung
# gekürzt wird:
#   tnum = gleich breite Ziffern (Uhrzeiten und Ergebnisse stehen exakt untereinander), NUR für 0-9 und den Doppelpunkt
#          (Inters tabellarischer Doppelpunkt ist schmaler; so passt „09:00“ in die Zeit-Spalte)
#   cv05 = kleines l mit Fuß, cv08 = großes I mit Serifen (DIN 1450: I und l unterscheidbar)
# tnum wird bewusst nicht auf alles angewendet: Inter setzt es auch auf Leerzeichen, Bindestrich, Punkt, Komma, Klammern
# und Klammern; ein globaler Freeze macht den Bindestrich 40 % breiter und das Leerzeichen schmaler („D - Junioren“).
# Deshalb friert ein eigener Schritt mit fontTools ein (statt pyftfeatfreeze, das nur alles oder nichts kann).
#
# Quelle: Inter 4.1 (github.com/rsms/inter, Release Inter-4.1.zip), Schnitte Regular und Bold, SHA-256 unten.
# Läuft in einem Wegwerf-Container (python:3.12-slim, arm64, --rm, trap räumt auf); nichts außer dem Arbeitsordner
# im Temp-Verzeichnis und den drei Zieldateien wird angefasst. Ausgabe:
#   src/lib/pdf/fontData/regular.ts, bold.ts, features.json
#
# Nutzung:  scripts/pdf-font-subset.sh [Pfad/zu/Inter-4.1.zip]
#           (ohne Argument lädt das Skript das Release und prüft die SHA-256)
#
# Die Unicode-Bereiche (UNICODES) müssen zu PDF_FONT.coverage in src/lib/pdf/fonts.ts passen;
# fontCmap.test.ts prüft die Gleichheit mit der cmap der erzeugten Schrift.
set -euo pipefail

INTER_URL="https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip"
INTER_SHA256="9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e"
IMAGE="python:3.12-slim"
FONTTOOLS_VERSION="4.55.3"
# Merkmal=Zeichen, die es bekommen (leer = alle Zeichen, die das Merkmal ersetzt)
FREEZE_FEATURES="tnum=0123456789:,cv05=,cv08="
# Fester Zeitstempel (head.modified), damit zwei Läufe byte-gleiche Dateien liefern (15.11.2024, Datum der Inter-Dateien)
SOURCE_DATE_EPOCH_VALUE="1731628800"
UNICODES="U+0020-007E,U+00A0-00AC,U+00AE-0148,U+014A-01C3,U+01C5-024F,U+0374-0376,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03D7,U+03DC-03DD,U+03F0-03F6,U+03F9-03FA,U+03FC-0479,U+0480-049D,U+04A0-04FF,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+20AC"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$REPO_ROOT/src/lib/pdf/fontData"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/pdf-font-subset.XXXXXX")"
CONTAINER="pdf-font-subset-$$"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

ZIP="${1:-}"
if [ -z "$ZIP" ]; then
  ZIP="$WORK/Inter-4.1.zip"
  curl -sSL -o "$ZIP" "$INTER_URL"
fi
ACTUAL_SHA="$(shasum -a 256 "$ZIP" | cut -d' ' -f1)"
if [ "$ACTUAL_SHA" != "$INTER_SHA256" ]; then
  echo "SHA-256 stimmt nicht: erwartet $INTER_SHA256, gefunden $ACTUAL_SHA" >&2
  exit 1
fi

mkdir -p "$WORK/in" "$WORK/out"
unzip -o -q "$ZIP" 'extras/ttf/Inter-Regular.ttf' 'extras/ttf/Inter-Bold.ttf' -d "$WORK/in"

# Im Container: einfrieren, auf die Abdeckung kürzen (Hinting, Layout-Merkmale und GSUB/GPOS-Regeln fallen weg, Glyph-
# Namen bleiben für die Prüfung der Glyphen), features.json aus der erzeugten Schrift ableiten.
cat >"$WORK/build.sh" <<'INNER'
set -euo pipefail
pip install -q --disable-pip-version-check --root-user-action=ignore "fonttools==${FONTTOOLS_VERSION}"
python - <<'PY'
import os
from fontTools.ttLib import TTFont

def freeze(font, tag, chars):
    """cmap auf die Glyphen umstellen, die das Merkmal `tag` einsetzt (nur Einzelersetzungen), nur für `chars` (leer = alle)."""
    gsub = font["GSUB"].table
    mapping = {}
    for record in gsub.FeatureList.FeatureRecord:
        if record.FeatureTag != tag:
            continue
        for index in record.Feature.LookupListIndex:
            lookup = gsub.LookupList.Lookup[index]
            for sub in lookup.SubTable:
                part = sub.ExtSubTable if lookup.LookupType == 7 else sub
                mapping.update(part.mapping)
    changed = 0
    for table in font["cmap"].tables:
        for code, glyph in list(table.cmap.items()):
            if glyph in mapping and (not chars or chr(code) in chars):
                table.cmap[code] = mapping[glyph]
                changed += 1
    if not changed:
        raise SystemExit(f"Merkmal {tag} hat nichts verändert")

for weight in ("Regular", "Bold"):
    font = TTFont(f"/w/in/extras/ttf/Inter-{weight}.ttf")
    for entry in os.environ["FREEZE_FEATURES"].split(","):
        tag, chars = entry.split("=")
        freeze(font, tag, chars)
    font.save(f"/w/out/frozen-{weight}.ttf")
PY
for weight in Regular Bold; do
  pyftsubset "/w/out/frozen-${weight}.ttf" --unicodes="${UNICODES}" --layout-features='' --no-hinting \
    --glyph-names --name-IDs='*' --output-file="/w/out/${weight}.ttf"
done
python - <<'PY'
import json
import os
from fontTools.ttLib import TTFont

CHARS = "0123456789Il"
# Zeichen, die der Freeze NICHT anfassen darf (Inter setzt tnum auch auf sie): Breite wie in der unveränderten Schrift
KEPT = " -.,()"
result = {}
for weight in ("Regular", "Bold"):
    standard = TTFont(f"/w/in/extras/ttf/Inter-{weight}.ttf").getBestCmap()
    font = TTFont(f"/w/out/{weight}.ttf")
    cmap = font.getBestCmap()
    advance = font["hmtx"]
    glyphs = {c: {"glyph": cmap[ord(c)], "standard": standard[ord(c)]} for c in CHARS}
    result[weight.lower()] = {
        "glyphs": glyphs,
        "digitAdvance": sorted({advance[glyphs[c]["glyph"]][0] for c in CHARS[:10]}),
        "kept": {c: TTFont(f"/w/in/extras/ttf/Inter-{weight}.ttf")["hmtx"][standard[ord(c)]][0] for c in KEPT},
    }
if result["regular"]["glyphs"] != result["bold"]["glyphs"]:
    raise SystemExit("Regular und Bold wählen verschiedene Glyphen")
out = {
    "source": "Inter 4.1",
    "frozenFeatures": {e.split("=")[0]: (e.split("=")[1] or "alle") for e in os.environ["FREEZE_FEATURES"].split(",")},
    "glyphs": result["regular"]["glyphs"],
    "digitAdvanceUnits": {w: result[w]["digitAdvance"] for w in result},
    "keptAdvanceUnits": {w: result[w]["kept"] for w in result},
}
json.dump(out, open("/w/out/features.json", "w"), ensure_ascii=False, indent=2)
PY
INNER

docker run --rm --name "$CONTAINER" --platform linux/arm64 -v "$WORK:/w" \
  -e FONTTOOLS_VERSION="$FONTTOOLS_VERSION" \
  -e FREEZE_FEATURES="$FREEZE_FEATURES" -e UNICODES="$UNICODES" -e SOURCE_DATE_EPOCH="$SOURCE_DATE_EPOCH_VALUE" \
  "$IMAGE" bash /w/build.sh

write_ts() { # <Schnitt klein> <Schnitt groß> <Datei>
  {
    cat <<EOF
/**
 * Schriftdatei für das PDF (B-28a2b), base64 einer TTF-Teilmenge. Generiert, nicht von Hand ändern.
 * Quelle: Inter 4.1 (github.com/rsms/inter, Release Inter-4.1.zip, extras/ttf/Inter-$2.ttf), Schnitt $2.
 * Fest eingebackene Merkmale (Feature-Freeze, Merkmal=Zeichen = $FREEZE_FEATURES): gleich breite Ziffern 0-9 und Doppelpunkt, l mit
 * Fuß, I mit Serifen (C-PDF-SCHRIFT-OHNE-MERKMALE). Danach mit pyftsubset auf Latein, Griechisch und Kyrillisch erweitert
 * gekürzt (Abdeckung siehe fonts.ts), Name-IDs erhalten (--name-IDs='*'), Glyph-Namen erhalten (--glyph-names).
 * Erzeugt mit scripts/pdf-font-subset.sh (fonttools $FONTTOOLS_VERSION).
 * SHA-256 des Release-Archivs: $INTER_SHA256.
 * Lizenz: SIL Open Font License 1.1, kein Reserved Font Name, siehe LICENSE.txt im selben Ordner.
 */
EOF
    printf "export default '"
    base64 <"$WORK/out/$2.ttf" | tr -d '\n'
    printf "';\n"
  } >"$3"
}

write_ts regular Regular "$TARGET/regular.ts"
write_ts bold Bold "$TARGET/bold.ts"
cp "$WORK/out/features.json" "$TARGET/features.json"
echo "Fertig: $TARGET/regular.ts, bold.ts, features.json"
