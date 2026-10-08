#!/bin/sh
# Codespace her açıldığında pixelBrain'i arkada başlatır (açıksa dokunmaz). Sayfa 4700 portunda, yalnız sana açık.
cd "$(dirname "$0")/.."
mkdir -p .durum
curl -fs -o /dev/null http://127.0.0.1:4700/api/surum 2>/dev/null && exit 0
setsid nohup ./baslat.sh > .durum/codespace.log 2>&1 < /dev/null &
