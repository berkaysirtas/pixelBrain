#!/bin/sh
# pixelBrain kurulumu (macOS; Linux'ta sınanmadı). Görsel önce ikinci beyin: tuval, Defter, Codex ve kalıcı hafıza.
#   Tek satır:        curl -fsSL https://raw.githubusercontent.com/berkaysirtas/pixelBrain/main/kur.sh | sh
#   Başka klasöre:    curl -fsSL https://raw.githubusercontent.com/berkaysirtas/pixelBrain/main/kur.sh | sh -s -- ~/Belgeler/pixelBrain
#   İndirdiğin klasörde: sh kur.sh
# Var olan hiçbir dosyanın üstüne yazmaz: kurulu bir pixelBrain'de yalnız eksikleri tamamlar. Güncelleme uygulamanın içinden yapılır.
# Ajanla kurulum (Codex, Claude Code): KURULUM.md
set -eu
DEPO="berkaysirtas/pixelBrain"

python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null \
  || { echo "Python 3.11 ya da üstü gerekli: https://www.python.org/downloads/"; exit 1; }

if [ -n "${1:-}" ]; then
  HEDEF="$1"
elif [ -f motor/sunucu.py ] && [ -f program.json ]; then
  HEDEF="$PWD"
else
  HEDEF="$HOME/pixelBrain"
fi
if [ -f "$HEDEF/araclar/yayinla.py" ]; then
  echo "Bu klasör pixelBrain'in kaynak kopyası; kurulum ve güncelleme burada çalışmaz."; exit 1
fi
mkdir -p "$HEDEF"
HEDEF=$(cd "$HEDEF" && pwd)

if [ ! -f "$HEDEF/program.json" ]; then
  echo "pixelBrain indiriliyor…"
  GECICI=$(mktemp -d)
  trap 'rm -rf "$GECICI"' EXIT
  ARSIV=$(curl -fsSL "https://api.github.com/repos/$DEPO/releases/latest" \
    | python3 -c 'import json, sys; print(json.load(sys.stdin)["tarball_url"])')
  curl -fsSL "$ARSIV" -o "$GECICI/beyin.tar.gz"
  mkdir "$GECICI/ac"
  tar -xzf "$GECICI/beyin.tar.gz" -C "$GECICI/ac"
  KAYNAK=$(dirname "$(find "$GECICI/ac" -maxdepth 2 -name program.json | head -1)")
  (cd "$KAYNAK" && find . -type f) | while IFS= read -r f; do
    if [ ! -e "$HEDEF/$f" ]; then
      mkdir -p "$HEDEF/$(dirname "$f")"
      cp -p "$KAYNAK/$f" "$HEDEF/$f"
    fi
  done
fi
cd "$HEDEF"
mkdir -p panolar notlar sayfalar .durum
chmod +x baslat.sh "Beyni Aç.command" "Beyni Kapat.command" 2>/dev/null || true

echo "Hafıza katmanı kuruluyor…"
if ! python3 hafiza/scripts/install_v3.py --vault "$HEDEF" --exclude-component launchers > .durum/hafiza-kurulum.json 2> .durum/hafiza-kurulum.log; then
  echo "Hafıza katmanı kurulamadı:"; tail -3 .durum/hafiza-kurulum.log; exit 1
fi

if [ "${BEYIN_TARAYICI:-1}" = "0" ]; then
  echo "Tarayıcı motoru atlandı (BEYIN_TARAYICI=0); panoların küçük resimleri çıkmaz."
elif command -v npm >/dev/null 2>&1; then
  echo "Panoların küçük resimleri için tarayıcı motoru kuruluyor (bir kez)…"
  # Kilit dosyası yazılmaz: program dosyası değişmesin, güncellemede sahte çakışma çıkmasın
  if ! { npm install --silent --no-audit --no-fund --no-package-lock >/dev/null 2>&1 && npx --yes playwright install chromium >/dev/null 2>&1; }; then
    echo "Not: Playwright kurulamadı, küçük resimler çıkmaz. Sonra: npm install && npx playwright install chromium"
  fi
else
  echo "Not: Node.js yok, panoların küçük resimleri çıkmaz. https://nodejs.org kurup bu betiği yeniden çalıştır."
fi
command -v codex >/dev/null 2>&1 \
  || echo "Not: Codex CLI yok. pixelBrain'in yapay zekâsı Codex'le çalışır: npm install -g @openai/codex, sonra codex login"

echo ""
echo "pixelBrain hazır: $HEDEF"
echo "Aç: klasördeki 'Beyni Aç' dosyasına çift tıkla (ya da ./baslat.sh), sonra http://127.0.0.1:4700"
echo "Video özetleri için (isteğe bağlı): sh araclar/video-kur.sh"
