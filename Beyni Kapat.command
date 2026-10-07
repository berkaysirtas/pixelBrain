#!/bin/sh
# Beyin'i kapatır (K-076): sunucudan kapanmasını ister; Codex'in süren turu varsa sunucu reddeder ve söyler. Çift tıkla.
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-4700}"; ADRES="http://127.0.0.1:$PORT"
if ! curl -s -m 2 -o /dev/null "$ADRES/"; then echo "Beyin zaten kapalı."; exit 0; fi
cevap=$(curl -s -m 5 -X POST -H 'Content-Type: application/json' -d '{}' "$ADRES/api/kapat")
case "$cevap" in
  *'"tamam"'*) ;;
  *) echo "Kapatılamadı: $cevap"; exit 1 ;;
esac
i=0
while curl -s -m 1 -o /dev/null "$ADRES/"; do
  i=$((i + 1))
  if [ "$i" -ge 20 ]; then echo "Beyin hâlâ cevap veriyor; yeniden dene."; exit 1; fi
  sleep 0.5
done
echo "Beyin kapandı. Açmak için: Beyni Aç"
