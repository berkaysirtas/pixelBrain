#!/bin/sh
# Beyin'i açar (K-076): sunucu çalışmıyorsa arka planda başlatır, sonra pencereyi açar. Sunucu bu pencereye, terminale ya da bir
# Claude oturumuna bağlı kalmaz; "Beyni Kapat" ya da Ayarlar › Program › Kapat diyene kadar açık kalır. Çift tıkla.
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-4700}"; ADRES="http://127.0.0.1:$PORT"
if curl -s -m 2 -o /dev/null "$ADRES/"; then
  echo "Beyin zaten açık."
else
  echo "Beyin başlatılıyor…"
  mkdir -p .durum
  PORT="$PORT" nohup ./baslat.sh >> .durum/sunucu.log 2>&1 &
  i=0
  until curl -s -m 1 -o /dev/null "$ADRES/"; do
    i=$((i + 1))
    if [ "$i" -ge 40 ]; then echo "Beyin açılamadı. Son satırlar (.durum/sunucu.log):"; tail -5 .durum/sunucu.log; exit 1; fi
    sleep 0.5
  done
fi
open "$ADRES"
echo "Beyin açık: $ADRES · Bu pencereyi kapatabilirsin."
