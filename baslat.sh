#!/bin/sh
# Beyni yerelde açar: http://127.0.0.1:4700
cd "$(dirname "$0")"
BEYIN_PANOLAR="$PWD/panolar" BEYIN_DURUM="$PWD/.durum" BEYIN_AD="Beyin" PORT="${PORT:-4700}" exec python3 motor/sunucu.py
