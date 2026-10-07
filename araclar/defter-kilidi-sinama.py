# Defter kilidi sınaması (K-066): python3 araclar/defter-kilidi-sinama.py. Sunucu ve Codex gerekmez; geçici bir kasada
# motor/sunucu.py'nin kilit işlevleri çağrılır. Dört durum: Codex'in izinsiz değişikliği geri alınır ve yedeklenir; tur
# sürerken kullanıcının kendi kaydı korunur; "Defter'e yaz" denen turda kilit yok; değişiklik yoksa geri alma da yok.
import json
import os
import shutil
import sys
import tempfile

KASA = tempfile.mkdtemp(prefix='beyin-kilit-')
os.makedirs(os.path.join(KASA, 'panolar'))
os.environ.update(BEYIN_PANOLAR=os.path.join(KASA, 'panolar'), BEYIN_KOK=KASA, BEYIN_DURUM=os.path.join(KASA, '.tuval'))
with open(os.path.join(KASA, 'calisma.json'), 'w', encoding='utf-8') as f:
    json.dump({'calisma_alanlari': [{'id': 'ca', 'ad': 'Deneme', 'izole': True, 'alanlar': [{'id': 'kilit-alan', 'ad': 'Kilit alanı', 'sayfa': 'page-kilit-alan'}]}]}, f)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'motor'))
import sayfalar  # noqa: E402
import sunucu  # noqa: E402

sonuc, hatalar = {}, []
defter = sayfalar.ana_not(KASA, 'kilit-alan', 'Kilit alanı')
yol = os.path.join(KASA, 'sayfalar', 'kilit-alan', defter['id'] + '.md')
govde = lambda: sayfalar.oku(KASA, defter['id'])['govde']
sunucu.sayfa_yaz({'id': defter['id'], 'govde': 'ilk hâl'})


def codex_yazar(metin):
    with open(yol, 'a', encoding='utf-8') as f:
        f.write(metin + '\n')


try:
    # 1. İzinsiz: kullanıcı turda yazar (korunur), Codex dosyaya ekler (geri alınır, yedeklenir)
    sunucu.defter_kilidi_kur('kilit-alan', 't1', 'bu alanı özetle', sunucu.defter_dosyalari('kilit-alan'))
    sunucu.sayfa_yaz({'id': defter['id'], 'govde': 'kullanıcı turda yazdı'})
    codex_yazar('CODEX SATIRI')
    sunucu.defter_denetle('t1')
    yedekler = os.listdir(os.path.join(KASA, '.durum', 'codex-defter'))
    sonuc['izinsiz'] = {'govde': govde(), 'geri': len(sunucu.DEFTER_GERI), 'yedekte_codex': any('CODEX SATIRI' in open(os.path.join(KASA, '.durum', 'codex-defter', y), encoding='utf-8').read() for y in yedekler)}
    if sonuc['izinsiz'] != {'govde': 'kullanıcı turda yazdı', 'geri': 1, 'yedekte_codex': True}:
        hatalar.append('izinsiz')
    # 2. İzinli: "Defter'e yaz" denen turda Codex'in yazdığı kalır
    sunucu.defter_kilidi_kur('kilit-alan', 't2', "Bunu Defter'e yaz lütfen", sunucu.defter_dosyalari('kilit-alan'))
    codex_yazar('IZINLI SATIR')
    sunucu.defter_denetle('t2')
    sonuc['izinli'] = {'kaldi': 'IZINLI SATIR' in govde(), 'geri': len(sunucu.DEFTER_GERI)}
    if sonuc['izinli'] != {'kaldi': True, 'geri': 1}:
        hatalar.append('izinli')
    # 3. Değişiklik yok: geri alma da yok
    sunucu.defter_kilidi_kur('kilit-alan', 't3', 'soru sor', sunucu.defter_dosyalari('kilit-alan'))
    sunucu.defter_denetle('t3')
    sonuc['degismedi'] = {'geri': len(sunucu.DEFTER_GERI)}
    if sonuc['degismedi'] != {'geri': 1}:
        hatalar.append('degismedi')
    # 4. Kabuğa giden kayıt (/api/alan-durum › defter_geri): alan, dosya ve yedek
    sonuc['kayit'] = [{'alan': x['alan'], 'dosya': x['dosya'], 'yedek': x['yedek'].startswith(os.path.join('.durum', 'codex-defter'))} for x in sunucu.DEFTER_GERI]
    if sonuc['kayit'] != [{'alan': 'kilit-alan', 'dosya': os.path.join('sayfalar', 'kilit-alan', defter['id'] + '.md'), 'yedek': True}]:
        hatalar.append('kayit')
except Exception as e:  # noqa: BLE001
    hatalar.append('HATA: ' + repr(e)[:200])
finally:
    shutil.rmtree(KASA, ignore_errors=True)
print(json.dumps({'sonuc': sonuc, 'hatalar': hatalar}, ensure_ascii=False, indent=1))
sys.exit(1 if hatalar else 0)
