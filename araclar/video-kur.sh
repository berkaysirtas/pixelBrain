#!/bin/sh
# Video araçları Beyin'in kendi klasöründe (K-067): .arac/video (git dışı), yt-dlp ve mlx-whisper; ffmpeg sistemden (brew).
# Global watch-youtube skill'ine bağlı değil. Kullanım: sh araclar/video-kur.sh · baştan kurmak için önce rm -rf .arac/video
cd "$(dirname "$0")/.." || exit 1
HEDEF=.arac/video
if command -v uv >/dev/null 2>&1; then
  [ -x "$HEDEF/bin/python" ] || uv venv "$HEDEF" --python 3.11 || exit 1
  uv pip install --python "$HEDEF/bin/python" -U yt-dlp mlx-whisper || exit 1
else
  [ -x "$HEDEF/bin/python" ] || python3.11 -m venv "$HEDEF" || exit 1
  "$HEDEF/bin/pip" install -U yt-dlp mlx-whisper || exit 1
fi
command -v ffmpeg >/dev/null 2>&1 || echo "uyarı: ffmpeg yok (brew install ffmpeg)"
"$HEDEF/bin/yt-dlp" --version && [ -x "$HEDEF/bin/mlx_whisper" ] && echo "video araçları hazır: $HEDEF"
