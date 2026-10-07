# İzolasyon sınaması (K-079): python3 araclar/izolasyon-sinama.py. Sunucu ve Codex gerekmez; geçici bir kasada
# motor/sunucu.py'nin izin_profili işlevi çağrılır. Bakılanlar: izole çalışma alanının Codex'i başka çalışma alanının notlarını,
# Defter'lerini, kaynaklarını ve panolarını, konuşma arşivini, iş kayıtlarını ve başka işleri taşıyan oturum dosyalarını
# okuyamaz; kendi klasörleri ve program dosyaları açık. İzole olmayan ve program (gizli) alanında profil yok.
import json
import os
import shutil
import sys
import tempfile

KASA = tempfile.mkdtemp(prefix='beyin-izolasyon-')
PANOLAR = os.path.join(KASA, 'panolar')
for d in ('panolar', 'notlar/a1', 'notlar/b1', 'notlar/eski', 'sayfalar/a1', 'sayfalar/b1', 'ham/kaynaklar/ca', 'ham/kaynaklar/cb',
          'ham/kaynaklar/_genel', 'ham/konusmalar', 'receipts', 'daily', 'ben', 'knowledge/concepts', 'knowledge/tercihler'):
    os.makedirs(os.path.join(KASA, d), exist_ok=True)
os.environ.update(BEYIN_PANOLAR=PANOLAR, BEYIN_KOK=KASA, BEYIN_DURUM=os.path.join(KASA, '.tuval'))
with open(os.path.join(KASA, 'calisma.json'), 'w', encoding='utf-8') as f:
    json.dump({'calisma_alanlari': [
        {'id': 'ca', 'ad': 'İzole', 'izole': True, 'alanlar': [{'id': 'a1', 'ad': 'A1', 'sayfa': 'page-a1'}]},
        {'id': 'cb', 'ad': 'Açık', 'izole': False, 'alanlar': [{'id': 'b1', 'ad': 'B1', 'sayfa': 'page-b1'}]},
        {'id': 'cp', 'ad': 'Program', 'izole': True, 'gizli': True, 'alanlar': [{'id': 'p1', 'ad': 'P1', 'sayfa': 'page-p1'}]}]}, f)
with open(os.path.join(PANOLAR, 'canvas.json'), 'w', encoding='utf-8') as f:
    json.dump({'pages': [{'id': p} for p in ('page-a1', 'page-b1', 'page-p1')], 'order': [], 'boards': {
        'Benim.dc.html': {'page': 'page-a1'}, 'Onun.dc.html': {'page': 'page-b1'}, 'Program.dc.html': {'page': 'page-p1'}}}, f)
for ad, proje in (('ca-notu.md', 'ca'), ('cb-notu.md', 'cb'), ('ortak.md', '')):
    with open(os.path.join(KASA, 'knowledge/concepts', ad), 'w', encoding='utf-8') as f:
        f.write('---\n' + json.dumps({'kind': 'fact', **({'project': proje} if proje else {})}) + '\n---\n# x\n')
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'motor'))
import sunucu  # noqa: E402

sonuc, hatalar = {}, []
k = lambda *p: os.path.join(KASA, *p)
try:
    prof = sunucu.izin_profili('a1')
    fs = (prof or {}).get('filesystem', {})
    yasak = lambda y: fs.get(y) == 'deny'
    beklenen_yasak = [k('notlar/b1'), k('notlar/eski'), k('sayfalar/b1'), k('ham/kaynaklar/cb'), k('ham/kaynaklar/_genel'), k('ham/konusmalar'),
                      k('receipts'), k('daily'), k('ben/Last-Session.md'), k('ben/Threads.md'), k('calisma.json'), os.path.join(PANOLAR, 'canvas.json'),
                      os.path.join(PANOLAR, 'Onun.dc.html'), os.path.join(PANOLAR, 'Program.dc.html'), k('knowledge/concepts/cb-notu.md')]
    beklenen_acik = [k('notlar/a1'), k('sayfalar/a1'), k('ham/kaynaklar/ca'), os.path.join(PANOLAR, 'Benim.dc.html'), k('knowledge/concepts/ca-notu.md'),
                     k('knowledge/concepts/ortak.md'), k('ben/Core.md'), k('ben/Kurallar.md'), k('BEYIN.md'), os.path.join(PANOLAR, 'tema.css')]
    sonuc['izole'] = {'profil': bool(prof), 'kalitim': (prof or {}).get('extends'), 'ag': (prof or {}).get('network'),
                      'yasak_eksik': [os.path.relpath(y, KASA) for y in beklenen_yasak if not yasak(y)],
                      'acik_kalmali_ama_yasak': [os.path.relpath(y, KASA) for y in beklenen_acik if y in fs],
                      'alt_klasor_de': yasak(k('notlar/b1') + '/**') and yasak(k('ham/konusmalar') + '/**')}
    if sonuc['izole'] != {'profil': True, 'kalitim': ':workspace', 'ag': {'enabled': True}, 'yasak_eksik': [], 'acik_kalmali_ama_yasak': [], 'alt_klasor_de': True}:
        hatalar.append('izole')
    sonuc['izole_olmayan'] = sunucu.izin_profili('b1')
    sonuc['program_alani'] = sunucu.izin_profili('p1')
    sonuc['bilinmeyen_alan'] = sunucu.izin_profili('yok')
    if sonuc['izole_olmayan'] or sonuc['program_alani'] or sonuc['bilinmeyen_alan']:
        hatalar.append('profil_olmamali')
finally:
    shutil.rmtree(KASA, ignore_errors=True)
print(json.dumps({'sonuc': sonuc, 'hatalar': hatalar}, ensure_ascii=False, indent=1))
sys.exit(1 if hatalar else 0)
