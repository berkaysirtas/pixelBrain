# Video süreci sınaması (K-067): python3 araclar/video-sinama.py. Ağ ve Codex gerekmez. Altyazı seçimi (videonun dili, özgün
# otomatik -orig, tr, en sırası) ve araç klasörü (ortam değişkeni, Beyin'in .arac/video'su) denetlenir.
import json
import os
import shutil
import sys
import tempfile

KASA = tempfile.mkdtemp(prefix='beyin-video-')
os.makedirs(os.path.join(KASA, 'panolar'))
os.environ.update(BEYIN_PANOLAR=os.path.join(KASA, 'panolar'), BEYIN_KOK=KASA, BEYIN_DURUM=os.path.join(KASA, '.tuval'))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'motor'))
import sunucu  # noqa: E402

sonuc, hatalar = {}, []


def sec(dosyalar, dil):
    k = tempfile.mkdtemp(dir=KASA)
    for f in dosyalar:
        open(os.path.join(k, f), 'w').close()
    y = sunucu.altyazi_sec(k, dil)
    return os.path.basename(y) if y else None


try:
    durumlar = {
        'dil_once': (['video.tr.vtt', 'video.en.vtt', 'video.en-orig.vtt'], 'en', 'video.en-orig.vtt'),
        'dil_bilinmiyor_orig': (['video.tr.vtt', 'video.en.vtt', 'video.de-orig.vtt'], '', 'video.de-orig.vtt'),
        'dil_bilinmiyor_tr': (['video.en.vtt', 'video.tr.vtt'], '', 'video.tr.vtt'),
        'altyazi_yok': ([], 'tr', None),
    }
    for ad, (dosyalar, dil, beklenen) in durumlar.items():
        sonuc[ad] = sec(dosyalar, dil)
        if sonuc[ad] != beklenen:
            hatalar.append(ad)
    arac = os.path.join(KASA, 'arac')
    os.makedirs(arac)
    open(os.path.join(arac, 'yt-dlp'), 'w').close()
    os.environ['BEYIN_VIDEO_ARAC'] = arac
    sonuc['ortam_degiskeni'] = sunucu.video_araci() == arac
    del os.environ['BEYIN_VIDEO_ARAC']
    sonuc['beyin_klasoru'] = sunucu.VIDEO_ARAC_BEYIN.endswith(os.path.join('.arac', 'video', 'bin'))
    if not (sonuc['ortam_degiskeni'] and sonuc['beyin_klasoru']):
        hatalar.append('arac')
except Exception as e:  # noqa: BLE001
    hatalar.append('HATA: ' + repr(e)[:200])
finally:
    shutil.rmtree(KASA, ignore_errors=True)
print(json.dumps({'sonuc': sonuc, 'hatalar': hatalar}, ensure_ascii=False, indent=1))
sys.exit(1 if hatalar else 0)
