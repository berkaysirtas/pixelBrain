#!/bin/sh
# GitHub Codespaces'te ilk açılış (K-086): pixelBrain'i bu klasöre kurar ve Codex CLI'ı ekler. Görüntü Codespaces'in hazır
# tuttuğu varsayılan görüntü (indirme beklemesi yok). Hızlı yol: panoların küçük resimleri için tarayıcı motoru atlanır;
# sonra istersen: npm install && npx playwright install --with-deps chromium
set -eu
cd "$(dirname "$0")/.."
command -v codex >/dev/null 2>&1 || npm install -g --no-audit --no-fund @openai/codex >/dev/null 2>&1 \
  || echo "Not: Codex CLI kurulamadı; terminalde: npm install -g @openai/codex"
BEYIN_TARAYICI=0 sh kur.sh "$PWD"
# Codex'in kum havuzu (bwrap) konteynerde açılıyor mu: açılmazsa pixelBrain Codex'i dış kum havuzu kipinde çalıştırır (K-086)
rm -f .durum/codex-kum-yok
if command -v codex >/dev/null 2>&1 && ! codex sandbox -- true >/dev/null 2>&1; then
  date > .durum/codex-kum-yok
  echo "Not: Codex'in kum havuzu bu konteynerde açılmadı; sınır codespace'in kendisi olacak."
fi
