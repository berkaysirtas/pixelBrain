#!/usr/bin/env python3
"""Güncelleyicinin sınaması (motor/guncelle.py), ağsız ve modelsiz: python3 araclar/guncelle-sinama.py

Geçici kasalarda sahte sürümler kurar ve şunları denetler: veri yolları listeye giremez; elle değişmemiş dosya yenisiyle
değişir, değişmiş olan yedeklenip çakışma olur; yeni sürümde olmayan dosya elle değişmemişse silinir, değişmişse kalır;
geri alma her şeyi eski hâline döndürür; bozuk, korunan yere yazmak isteyen ya da dışarı çıkan paket hiçbir dosyaya
dokunmadan reddedilir; kaynak kopyada çalışmaz; yedeklerden son beşi kalır; çalıştırılabilir bit korunur.
Çıktı tek satır JSON: {"hatalar": [...]}. Hata varsa her biri ayrıca HATA satırı olarak yazılır, çıkış 1.
"""
import hashlib
import io
import json
import os
import shutil
import sys
import tarfile
import tempfile

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'motor'))
import guncelle  # noqa: E402

hatalar = []
VERI = {'notlar/is/K-001.md': b'karar', 'sayfalar/is/s-1.md': b'defter', 'ben/Core.md': b'ben', 'calisma.json': b'{}',
        'panolar/canvas.json': b'{"boards":{}}', 'panolar/Pano.dc.html': b'<div>pano</div>'}


def bekle(kosul, ad):
    if not kosul:
        hatalar.append(ad)


def sha(b):
    return hashlib.sha256(b).hexdigest()


def kasa(surum, dosyalar):
    """Kurulu bir kasa: program dosyaları, program.json ve kullanıcı verisi."""
    kok = tempfile.mkdtemp(prefix='guncelle-sinama-')
    for yol, icerik in {**dosyalar, **VERI}.items():
        os.makedirs(os.path.dirname(os.path.join(kok, yol)) or kok, exist_ok=True)
        open(os.path.join(kok, yol), 'wb').write(icerik)
    program = {'ad': 'pixelBrain', 'depo': '', 'surum': surum, 'dosyalar': {y: sha(b) for y, b in dosyalar.items()}}
    open(os.path.join(kok, 'program.json'), 'w').write(json.dumps(program))
    return kok


def paket(surum, dosyalar, liste=None, ek=None, modlar=None):
    """GitHub tarball'ı gibi tek üst klasörlü tar.gz. liste verilirse program.json'a o yazılır (bozuk paket için)."""
    yol = tempfile.mktemp(suffix='.tar.gz')
    program = {'ad': 'pixelBrain', 'depo': '', 'surum': surum, 'dosyalar': liste or {y: sha(b) for y, b in dosyalar.items()}}
    with tarfile.open(yol, 'w:gz') as t:
        for ad, icerik in {**dosyalar, 'program.json': json.dumps(program).encode(), **(ek or {})}.items():
            bilgi = tarfile.TarInfo(ad if ad.startswith('..') else 'sahip-pixelBrain-abc/' + ad)
            bilgi.size, bilgi.mode = len(icerik), (modlar or {}).get(ad, 0o644)
            t.addfile(bilgi, io.BytesIO(icerik))
    return yol


def oku(kok, yol):
    p = os.path.join(kok, yol)
    return open(p, 'rb').read() if os.path.isfile(p) else None


def veri_yerinde(kok):
    return all(oku(kok, y) == b for y, b in VERI.items())


def reddedilir(kok, pk, ad):
    once = {y: oku(kok, y) for y in ['motor/a.py', 'program.json', *VERI]}
    try:
        guncelle.kur(kok, pk)
        hatalar.append(ad + ': reddedilmedi')
    except (ValueError, RuntimeError, tarfile.TarError):
        bekle(all(oku(kok, y) == b for y, b in once.items()), ad + ': reddedilirken dosya değişti')


ESKI = {'motor/a.py': b'A1', 'motor/b.py': b'B1', 'motor/c.py': b'C1', 'motor/e.py': b'E1'}
YENI = {'motor/a.py': b'A2', 'motor/b.py': b'B2', 'motor/d.py': b'D2', 'baslat.sh': b'#!/bin/sh\n'}
kasalar = []

# 1. Yol koruması
for yol in ('motor/x.py', 'panolar/tema.css', 'BEYIN.md', 'hafiza/scripts/install_v3.py'):
    bekle(guncelle.yol_gecerli(yol), 'geçerli yol reddedildi: ' + yol)
for yol in ('notlar/a.md', 'sayfalar/a/s.md', 'ben/Core.md', 'knowledge/x.md', 'ham/kaynaklar/x', 'calisma.json',
            'panolar/canvas.json', 'panolar/Pano.dc.html', 'panolar/_blob/x', '.claude/scripts/x.py', 'beyin.py', 'AGENTS.md',
            '.durum/x', '.git/config', '../x', '/etc/passwd', 'motor/../notlar/a.md', 'motor//a.py', 'motor\\a.py'):
    bekle(not guncelle.yol_gecerli(yol), 'korunan yol kabul edildi: ' + yol)

# 2. Güncelle: değişmemiş değişir, değişmiş yedeklenip çakışır, kalkan silinir ya da kalır, veri yerinde, bit korunur
k = kasa('0.1.0', ESKI); kasalar.append(k)
open(os.path.join(k, 'motor/b.py'), 'wb').write(b'B-kullanici')
open(os.path.join(k, 'motor/e.py'), 'wb').write(b'E-kullanici')
s = guncelle.kur(k, paket('0.2.0', YENI, modlar={'baslat.sh': 0o755}))
bekle(s['durum'] == 'guncellendi' and s['surum'] == '0.2.0', 'güncelleme durumu: ' + str(s.get('durum')))
bekle(oku(k, 'motor/a.py') == b'A2' and oku(k, 'motor/b.py') == b'B2' and oku(k, 'motor/d.py') == b'D2', 'yeni dosyalar yazılmadı')
bekle(s['cakisma'] == ['motor/b.py'], 'çakışma listesi yanlış: ' + str(s['cakisma']))
bekle(oku(k, os.path.join(s['yedek'], 'dosyalar', 'motor/b.py')) == b'B-kullanici', 'kullanıcının dosyası yedeklenmedi')
bekle(oku(k, 'motor/c.py') is None and s['silinen'] == ['motor/c.py'], 'değişmemiş eski dosya silinmedi')
bekle(oku(k, 'motor/e.py') == b'E-kullanici' and s['birakilan'] == ['motor/e.py'], 'kullanıcının değiştirdiği eski dosya silindi')
bekle(veri_yerinde(k), 'güncelleme kullanıcı verisine dokundu')
bekle(os.access(os.path.join(k, 'baslat.sh'), os.X_OK), 'çalıştırılabilir bit korunmadı')
bekle(guncelle.program_oku(k)['surum'] == '0.2.0', 'program.json yeni sürümü yazmadı')
bekle(guncelle.son_is(k) and guncelle.son_is(k)['cakisma'] == ['motor/b.py'], 'son güncelleme kaydı okunmadı')

# 3. Geri al: hepsi eski hâline
g = guncelle.geri(k)
bekle(g['surum'] == '0.1.0', 'geri alma sürümü: ' + str(g.get('surum')))
bekle(oku(k, 'motor/a.py') == b'A1' and oku(k, 'motor/b.py') == b'B-kullanici' and oku(k, 'motor/c.py') == b'C1', 'geri alma dosyaları döndürmedi')
bekle(oku(k, 'motor/d.py') is None and oku(k, 'baslat.sh') is None, 'geri alma eklenen dosyaları silmedi')
bekle(veri_yerinde(k) and guncelle.program_oku(k)['surum'] == '0.1.0', 'geri alma veriyi ya da program.json\'u bozdu')
bekle(guncelle.son_is(k) is None, 'geri alınan güncelleme hâlâ son iş görünüyor')

# 4. Aynı sürüm, aynı dosyalar: hiçbir şey değişmez, yedek açılmaz
k5 = kasa('0.1.0', ESKI); kasalar.append(k5)
s = guncelle.kur(k5, paket('0.1.0', ESKI))
bekle(s['durum'] == 'guncel', 'aynı sürüm durumu: ' + str(s.get('durum')))
bekle(all(oku(k5, y) == b for y, b in ESKI.items()) and veri_yerinde(k5), 'aynı sürüm dosyaları değiştirdi')
bekle(guncelle.son_is(k5) is None, 'aynı sürüm yedek açtı')

# 5. Reddedilen paketler: bozuk, korunan yere yazmak isteyen, dışarı çıkan, program.json'suz
k2 = kasa('0.1.0', ESKI); kasalar.append(k2)
reddedilir(k2, paket('0.2.0', YENI, liste={**{y: sha(b) for y, b in YENI.items()}, 'motor/a.py': sha(b'baska')}), 'bozuk paket')
reddedilir(k2, paket('0.2.0', {**YENI, 'notlar/is/K-001.md': b'ezildi'}), 'korunan yere yazan paket')
reddedilir(k2, paket('0.2.0', {**YENI, 'calisma.json': b'ezildi'}), 'calisma.json\'u ezen paket')
reddedilir(k2, paket('0.2.0', YENI, ek={'../disari.txt': b'x'}), 'dışarı çıkan paket')
yol = tempfile.mktemp(suffix='.tar.gz')
with tarfile.open(yol, 'w:gz') as t:
    b = tarfile.TarInfo('x/motor/a.py'); b.size = 2; t.addfile(b, io.BytesIO(b'A9'))
reddedilir(k2, yol, 'program.json\'suz paket')
bekle(not os.path.exists(os.path.join(os.path.dirname(k2), 'disari.txt')), 'paket kasanın dışına yazdı')

# 6. Kaynak kopyada çalışmaz
k3 = kasa('0.1.0', ESKI); kasalar.append(k3)
os.makedirs(os.path.join(k3, 'araclar')); open(os.path.join(k3, 'araclar', 'yayinla.py'), 'w').write('')
reddedilir(k3, paket('0.2.0', YENI), 'kaynak kopyada güncelleme')

# 7. Yedeklerden son beşi kalır
k4 = kasa('0.1.0', ESKI); kasalar.append(k4)
for i in range(7):
    guncelle.kur(k4, paket(f'0.1.{i + 1}', {**ESKI, 'motor/a.py': f'A{i}'.encode()}))
yedekler = [d for d in os.listdir(os.path.join(k4, '.durum', 'guncelleme')) if d.startswith(('yedek-', 'geri-alindi-'))]
bekle(len(yedekler) <= 5, f'yedek budanmadı: {len(yedekler)}')  # ürün kararı: son beş güncelleme
bekle(veri_yerinde(k4), 'art arda güncellemeler veriye dokundu')

for k in kasalar:
    shutil.rmtree(k, ignore_errors=True)
for h in hatalar:
    print('HATA', h)
print(json.dumps({'hatalar': hatalar}, ensure_ascii=False))
sys.exit(1 if hatalar else 0)
