#!/bin/sh
# Bütün duman sınamaları (sunucu açıkken): sh araclar/tum-duman.sh · Codex turu açanlar için: sh araclar/tum-duman.sh --codex
# Her sınama için tek satır: ad, hatalar ve HATA satırı sayısı. Ayrıntı .durum/duman/<ad>.txt
cd "$(dirname "$0")/.." || exit 1
mkdir -p .durum/duman
HIZLI="duman sayfa-duman ray-duman kimlik-duman sira-duman arac-duman canli-duman bilgi-duman kurulum-duman ogretici-duman video-gorunum-duman alan-sil-duman defter-link-duman veri-bekle-duman ayar-duman dogrula-duman defter-secim-duman defter-kilidi-duman defter-kilidi-sinama video-sinama sohbet-duman arkadas-duman pano-akis-sinama canli-cizim-duman izolasyon-sinama tablo-kart-duman guncelle-sinama"
CODEX="video-yerel-duman kaynak-duman oneri-duman yazi-duman eylem-duman cizim-codex-duman izolasyon-codex-duman"
LISTE=$HIZLI; [ "$1" = "--codex" ] && LISTE="$HIZLI $CODEX"
kirik=0
for t in $LISTE; do
  if [ -f "araclar/$t.py" ]; then python3 "araclar/$t.py" > ".durum/duman/$t.txt" 2>&1; else node "araclar/$t.mjs" > ".durum/duman/$t.txt" 2>&1; fi; kod=$?
  hata=$(grep -c 'HATA\|Error' ".durum/duman/$t.txt")
  bos=$(tr -d ' \n' < ".durum/duman/$t.txt" | grep -c '"hatalar":\[\]')
  if [ $kod -ne 0 ] || [ "$hata" -gt 0 ]; then kirik=$((kirik + 1)); echo "KIRIK  $t (çıkış $kod, $hata HATA satırı)"; else echo "tamam  $t"; fi
done
echo "kırık: $kirik"
[ $kirik -eq 0 ]
