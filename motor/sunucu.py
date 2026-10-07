#!/usr/bin/env python3
"""Beyin sunucusu. Kendi başına bir program: hiçbir skill'e ya da dış klasöre bağlı değil (başlangıçta bir kanvas motorundan kopyalandı, 2026-10-02).

BEYIN_PANOLAR'daki canvas.json + *.dc.html'i tarayıcıda pano yüzeyi olarak gösterir; kabuk (beyin.html) çalışma alanlarını ve veri eklemeyi verir.
Çalıştır: ./baslat.sh; port ve yollar ortam değişkeninden.

- Panolar artifact tuvalindeki çalışma motoruyla (dc-runtime) çizilir.
- Başlığından sürüklenen pano ya da notun yeri canvas.json'a yazılır.
- Dosya değişince açık panolar yenilenir; küçük resimler arka planda resim.mjs ile yeniden çekilir.
"""
import base64
import hashlib
import html
import json
import os
import queue
import re
import uuid
import shutil
import time as zaman
from datetime import date
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

from codex import Kopru
import guncelle
import hafiza
import sayfalar

KOK = os.path.dirname(os.path.abspath(__file__))
# Proje başına: tuval klasörü (canvas.json + panolar), blob klasörü ve durum klasörü (küçük resim, günlük)
PROJE = os.environ['BEYIN_PANOLAR']
BLOB = os.environ.get('BEYIN_BLOB', os.path.join(PROJE, '_blob'))
DURUM = os.environ.get('BEYIN_DURUM', os.path.join(os.path.dirname(PROJE), '.tuval'))
AD_ = os.environ.get('BEYIN_AD', os.path.basename(os.path.dirname(PROJE)))
MOTOR = os.path.join(KOK, 'dc-runtime.js')
# Beyin kökü: notlar/<alan>/*.md burada; panolar /api/notlar ile okur
BEYIN = os.environ.get('BEYIN_KOK', os.path.dirname(PROJE))
NOTLAR = os.path.join(BEYIN, 'notlar')
CALISMA = os.path.join(BEYIN, 'calisma.json')
KAYNAK = os.path.join(BEYIN, 'ham', 'kaynaklar')  # ortak katman: hiçbir çalışma alanına kilitlenmez
KISA = re.compile(r'[^a-z0-9]+')
KOPRU = Kopru(BEYIN, DURUM)
TR = str.maketrans('çğıöşüâîû', 'cgiosuaiu')
RESIM = os.path.join(DURUM, 'resim')
PORT = int(os.environ.get('PORT', '4620'))
TOPLU = 30  # bir resim.mjs koşusunda en çok pano
AD = re.compile(r'^[A-Za-z0-9_][A-Za-z0-9_.-]*$')
TUR = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
       '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
       '.webmanifest': 'application/manifest+json; charset=utf-8'}

kilit = threading.Lock()
durum = {'canvas': 0.0, 'surum': {}, 'resim': {}, 'bekleyen': 0, 'hatali': []}


def canvas_oku():
    with open(os.path.join(PROJE, 'canvas.json'), encoding='utf-8') as f:
        return json.load(f)


def canvas_yaz(c):
    yol = os.path.join(PROJE, 'canvas.json')
    gecici = yol + '.yaziliyor'
    with open(gecici, 'w', encoding='utf-8') as f:
        json.dump(c, f, ensure_ascii=False, indent=1)
        f.write('\n')
    os.replace(gecici, yol)

TUVAL_TUR = ('not', 'metin', 'sekil', 'bag')
DOLGULAR = ('gray', 'blue', 'green', 'orange', 'pink', 'purple', 'red', 'teal', 'yellow')


def tuval_oge(istek):
    """Tuval araç çubuğu A (K-045): not, metin, şekil ve bağ; canvas.json › notes. is: ekle, guncelle, sil. Kilit çağıranda."""
    is_ = istek.get('is', 'ekle')
    sayi = lambda k, ust=20000: max(-ust, min(ust, round(float(istek[k]))))
    c = canvas_oku()
    notlar = c.setdefault('notes', {})
    if is_ == 'ekle':
        tur = istek['tur']
        if tur not in TUVAL_TUR:
            raise ValueError('bilinmeyen öğe')
        sayfa = str(istek['sayfa'])
        if not any(p.get('id') == sayfa for p in c.get('pages', [])):
            raise ValueError('sayfa yok')
        nid = 'n-' + uuid.uuid4().hex[:10]
        n = {'page': sayfa, 'x': sayi('x'), 'y': sayi('y'), 'text': str(istek.get('text', ''))[:4000]}
        if tur == 'not':
            n.update(fill=istek.get('fill') if istek.get('fill') in DOLGULAR else 'yellow', w=220, size=16)
        elif tur == 'metin':
            n.update(kind='metin', size=22)
        elif tur == 'sekil':
            n.update(kind='sekil', w=180, h=110, sekil='daire' if istek.get('sekil') == 'daire' else 'kare')
        else:
            n.update(kind='bag', dx=sayi('dx', 8000), dy=sayi('dy', 8000))
        notlar[nid] = n
        canvas_yaz(c)
        return {'id': nid, 'not': n}
    if is_ == 'geri':  # geri al: silinen öğe aynı kimlikle, aynı haliyle döner
        n = dict(istek['not'])
        if not any(p.get('id') == n.get('page') for p in c.get('pages', [])):
            raise ValueError('sayfa yok')
        notlar[str(istek['id'])] = {k: v for k, v in n.items() if k in ('page', 'x', 'y', 'w', 'h', 'text', 'fill', 'size', 'kind', 'sekil', 'dx', 'dy', 'bold', 'italic', 'maxW', 'maxH')}
        canvas_yaz(c)
        return {'id': istek['id']}
    if is_ == 'pano-sil':  # pano tuvalden kalkar, dosyası durur; geri al kaydı döner
        ad = str(istek['ad'])
        pano = c.get('boards', {}).pop(ad)
        sira = c.get('order', []).index(ad) if ad in c.get('order', []) else -1
        if sira >= 0:
            c['order'].pop(sira)
        canvas_yaz(c)
        return {'pano': pano, 'sira': sira}
    if is_ == 'pano-geri':
        ad, pano = str(istek['ad']), dict(istek['pano'])
        if not os.path.exists(os.path.join(PROJE, ad)) or ad in c.get('boards', {}):
            raise ValueError('pano geri konamaz')
        c.setdefault('boards', {})[ad] = pano
        sira = c.setdefault('order', [])
        sira.insert(min(max(int(istek.get('sira', -1)), 0), len(sira)) if int(istek.get('sira', -1)) >= 0 else len(sira), ad)
        canvas_yaz(c)
        return {'ad': ad}
    n = notlar[str(istek['id'])]
    if is_ == 'sil':
        del notlar[str(istek['id'])]
    elif is_ == 'guncelle':
        if 'text' in istek:
            n['text'] = str(istek['text'])[:4000]
        if istek.get('fill') in DOLGULAR:
            n['fill'] = istek['fill']
        if istek.get('sekil') in ('kare', 'daire'):
            n['sekil'] = istek['sekil']
        for k in ('w', 'h'):
            if k in istek:
                n[k] = max(40, min(4000, round(float(istek[k]))))
    else:
        raise ValueError('bilinmeyen iş')
    canvas_yaz(c)
    return {'id': istek['id']}



def ithalat(dosya):
    try:
        with open(os.path.join(PROJE, dosya), encoding='utf-8') as f:
            metin = f.read()
    except OSError:
        return set()
    return {n + '.dc.html' for n in re.findall(r'<dc-import[^>]*\bname="([^"{]+)"', metin)}


def gozcu():
    """Dosya zamanlarını izler. Pano sürümü = kendisi ve içe aldıklarının en yeni zamanı."""
    zaman, ithal = {}, {}
    while True:
        try:
            simdi = {f: os.stat(os.path.join(PROJE, f)).st_mtime
                     for f in os.listdir(PROJE) if f.endswith('.dc.html') or f == 'canvas.json'}
        except OSError:
            time.sleep(1)
            continue
        if simdi != zaman:
            for f in simdi:
                if f != 'canvas.json' and zaman.get(f) != simdi[f]:
                    ithal[f] = ithalat(f)
            for f in set(ithal) - set(simdi):
                del ithal[f]
            zaman = simdi
            surum = {}
            for f in ithal:
                gor, yig = set(), [f]
                while yig:
                    x = yig.pop()
                    if x in gor or x not in simdi:
                        continue
                    gor.add(x)
                    yig += ithal.get(x, ())
                surum[f] = max(simdi[x] for x in gor)
            with kilit:
                durum['canvas'] = simdi.get('canvas.json', 0.0)
                durum['surum'] = surum
        time.sleep(0.7)


def resimci():
    """Küçük resmi olmayan ya da eskiyen panoları toplu çeker. Çizilemeyen pano, değişene kadar atlanır."""
    os.makedirs(RESIM, exist_ok=True)
    hatali = {}
    while True:
        time.sleep(1.5)
        with kilit:
            surum = dict(durum['surum'])
        try:
            panolar = canvas_oku()['boards']
        except (OSError, ValueError, KeyError):
            continue
        resim, eski = {}, []
        for ad in sorted(panolar):
            png = os.path.join(RESIM, ad[:-8] + '.png')
            z = os.stat(png).st_mtime if os.path.exists(png) else 0
            if z:
                resim[ad] = z
            if ad in surum and z < surum[ad] and hatali.get(ad) != surum[ad]:
                eski.append(ad)
        with kilit:
            durum['resim'] = resim
            durum['bekleyen'] = len(eski)
            durum['hatali'] = sorted(hatali)
        # Dosya hâlâ yazılıyorsa bekle
        if not eski or time.time() - max(surum[a] for a in eski) < 1.0:
            continue
        parti = eski[:TOPLU]
        try:
            cikti = subprocess.run(['node', os.path.join(KOK, 'resim.mjs'), *parti], cwd=KOK,
                                   env={**os.environ, 'PORT': str(PORT), 'BEYIN_PANOLAR': PROJE, 'BEYIN_RESIM': RESIM},
                                   capture_output=True, text=True, timeout=60 + 5 * len(parti)).stdout
        except (OSError, subprocess.TimeoutExpired) as hata:
            print('resim.mjs çalışmadı:', hata, flush=True)
            time.sleep(10)
            continue
        for satir in cikti.splitlines():
            sonuc, _, ad = satir.partition(' ')
            ad = ad.split(' ')[0]
            if sonuc == 'tamam':
                hatali.pop(ad, None)
            elif sonuc == 'hata':
                hatali[ad] = surum.get(ad)


def not_oku(yol):
    """Not dosyası: '---' arası 'anahtar: değer' satırları, sonrası gövde."""
    with open(yol, encoding='utf-8') as f:
        metin = f.read()
    alanlar, govde = {}, metin
    if metin.startswith('---\n'):
        bas, _, govde = metin[4:].partition('\n---')
        for satir in bas.splitlines():
            anahtar, ayrac, deger = satir.partition(':')
            if ayrac and anahtar.strip() and not anahtar.startswith('#'):
                alanlar[anahtar.strip()] = deger.split(' #')[0].strip()
    alanlar['govde'] = govde.lstrip('-\n').strip()
    return alanlar


def notlar():
    sonuc = []
    for alan in sorted(os.listdir(NOTLAR)) if os.path.isdir(NOTLAR) else []:
        klasor = os.path.join(NOTLAR, alan)
        for ad in sorted(os.listdir(klasor)) if os.path.isdir(klasor) else []:
            if ad.endswith('.md'):
                try:
                    sonuc.append({**not_oku(os.path.join(klasor, ad)), 'alan': alan, 'dosya': ad})
                except OSError:
                    pass
    return sonuc


def kisa_ad(metin):
    return KISA.sub('-', metin.replace('İ', 'i').lower().translate(TR)).strip('-')[:48] or 'adsiz'


def calisma_oku():
    try:
        with open(CALISMA, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {'calisma_alanlari': []}


def calisma_yaz(c):
    gecici = CALISMA + '.yaziliyor'
    with open(gecici, 'w', encoding='utf-8') as f:
        json.dump(c, f, ensure_ascii=False, indent=1)
        f.write('\n')
    os.replace(gecici, CALISMA)
    projeleri_bagla(c)


def projeleri_bagla(c):
    """Her alanın notlar/<alan>/ klasörü hep var olur (git boş klasörü tutmaz): hafıza eşlemesi yalnız var olan klasörü
    projeye bağlar; klasör eksik kalırsa sonradan yazılan not projesiz kalır, izole alan onu kendi aramasında bulamaz."""
    for ca in c.get('calisma_alanlari', []):
        for a in ca.get('alanlar', []):
            os.makedirs(os.path.join(NOTLAR, a['id']), exist_ok=True)
    hafiza.projeleri_yaz(BEYIN, c)  # hafıza: çalışma alanı klasörleri o projeye


def alanin_calismasi(alan):
    for ca in calisma_oku()['calisma_alanlari']:
        if any(a['id'] == alan for a in ca.get('alanlar', [])):
            return ca['id']
    return '_genel'


def veriler(calisma=None, alan=None):
    """ham/kaynaklar altındaki dosyalar, en yeni önce. Süzgeç yoksa hepsi (ortak beyin)."""
    kok = os.path.join(KAYNAK, *[p for p in (calisma, alan) if p])
    sonuc = []
    for dizin, _, dosyalar in os.walk(kok) if os.path.isdir(kok) else []:
        for ad in dosyalar:
            if ad.startswith('.'):
                continue
            yol = os.path.join(dizin, ad)
            parca = os.path.relpath(yol, KAYNAK).split(os.sep)
            sonuc.append({'ad': ad, 'yol': os.path.relpath(yol, BEYIN), 'calisma': parca[0], 'alan': parca[1] if len(parca) > 2 else '',
                          'boyut': os.path.getsize(yol), 'zaman': os.path.getmtime(yol)})
    return sorted(sonuc, key=lambda v: -v['zaman'])


def calisma_ozeti():
    """calisma.json + her alanın pano, not ve veri sayısı, ilk panonun küçük resmi."""
    c = calisma_oku()
    try:
        panolar = canvas_oku().get('boards', {})
    except (OSError, ValueError):
        panolar = {}
    notlar_ = notlar()
    for ca in c['calisma_alanlari']:
        for a in ca.get('alanlar', []):
            bunlar = [d for d, b in panolar.items() if b.get('page') == a.get('sayfa')]
            a['pano'] = len(bunlar)
            a['not'] = sum(1 for n in notlar_ if n['alan'] == a['id'] and n.get('durum') != 'vazgecildi')
            a['veri'] = len(veriler(ca['id'], a['id']))
            ilk = next((d for d in bunlar if os.path.exists(os.path.join(RESIM, d[:-8] + '.png'))), '')
            a['resim'] = '/resim/' + ilk[:-8] + '.png' if ilk else ''
    return c


def veri_ekle(istek):
    """Bulunulan bağlama veri: metin (.md), tek satır link (.url.txt) ya da dosya (base64). ham/ ortaktır."""
    calisma = kisa_ad(istek.get('calisma') or '_genel') if istek.get('calisma') else '_genel'
    alan = kisa_ad(istek['alan']) if istek.get('alan') else ''
    konu = kisa_ad(istek['konu']) if istek.get('konu') and alan else ''
    klasor = os.path.join(KAYNAK, calisma, *[p for p in (alan, konu) if p])
    os.makedirs(klasor, exist_ok=True)
    damga = zaman.strftime('%Y%m%d-%H%M%S')
    if istek.get('dosya'):
        ad, uz = os.path.splitext(istek['dosya']['ad'])
        yol = os.path.join(klasor, f'{damga}-{kisa_ad(ad)}{uz.lower()[:8]}')
        veri = base64.b64decode(istek['dosya']['icerik'])
    else:
        metin = (istek.get('metin') or '').strip()
        if not metin:
            raise ValueError('eklenecek bir şey yok')
        link = re.fullmatch(r'https?://\S+', metin)
        yol = os.path.join(klasor, f'{damga}-{kisa_ad(metin.splitlines()[0][:40])}' + ('.url.txt' if link else '.md'))
        veri = (metin + '\n').encode()
    with open(yol, 'wb') as f:
        f.write(veri)
    hafiza.projeleri_yaz(BEYIN, calisma_oku())  # yeni kaynak klasörü projeye bağlansın
    if alan and istek.get('dosya') and yol.lower().endswith(VIDEO_UZANTI):
        video_ekle({'alan': alan, 'dosya': os.path.relpath(yol, BEYIN)})  # bilgisayardan video: Kaynaklar'da sıraya girer
    if alan and not istek.get('dosya') and YOUTUBE.search(istek.get('metin') or ''):
        try:
            video_ekle({'alan': alan, 'url': istek['metin']})  # YouTube linki Kaynaklar'da sıraya girer (K-038)
        except ValueError:
            pass
    return os.path.relpath(yol, BEYIN)


def calisma_ekle(istek):
    c = calisma_oku()
    kimlik = kisa_ad(istek['ad'])
    if any(ca['id'] == kimlik for ca in c['calisma_alanlari']):
        raise ValueError('bu adda çalışma alanı var')
    c['calisma_alanlari'].append({'id': kimlik, 'ad': istek['ad'].strip(), 'aciklama': '', 'izole': istek.get('izole', True) is not False, 'alanlar': [],
                                  **({'ikon': istek['ikon']} if istek.get('ikon') else {}), **({'renk': istek['renk']} if istek.get('renk') in RENKLER else {}),
                                  **({'ogretici': True} if istek.get('ogretici') else {})})  # öğretici çalışma alanı (K-062)
    calisma_yaz(c)
    if istek.get('ikon_ciz', True):
        ikon_ciz_sirala({'calisma': kimlik})
    return kimlik


def alan_ekle(istek):
    """Çalışma alanına yeni alan: tuvalde sayfa ve notlar/<alan>/."""
    c = calisma_oku()
    ca = next(x for x in c['calisma_alanlari'] if x['id'] == istek['calisma'])
    kimlik = kisa_ad(istek['ad'])
    if alan_bul(kimlik)[1] or os.path.isdir(os.path.join(NOTLAR, kimlik)):
        raise ValueError('bu adda alan var')
    tuval = canvas_oku()
    tuval.setdefault('pages', []).append({'id': 'page-' + kimlik, 'name': istek['ad'].strip()})
    canvas_yaz(tuval)
    ca['alanlar'].append({'id': kimlik, 'ad': istek['ad'].strip(), 'sayfa': 'page-' + kimlik, **({'ikon': istek['ikon']} if istek.get('ikon') else {}),
                          **({'ders': kisa_ad(istek['ders'])} if istek.get('ders') else {})})  # öğretici dersi (K-062)
    calisma_yaz(c)
    if istek.get('ikon_ciz', True):
        ikon_ciz_sirala({'calisma': ca['id'], 'alan': kimlik})
    return kimlik


RENKLER = ('gri', 'kahve', 'turuncu', 'sari', 'yesil', 'mavi', 'mor', 'pembe', 'kirmizi')  # tema.css --r-* (K-031)


# Pixel art ikonlar (K-039): Codex her çalışma alanı ve alan için 12×12 ızgara çizer; '.' boş, 'k' koyu kontur, 'a' ana renk,
# 'b' açık ton, 'c' vurgu. Renk çalışma alanından gelir, ızgara calisma.json'da ikon_px. Çizim sıralı bir arka plan işçisinde:
# Codex turu 10-30 sn sürer, genel kilit yalnız sonucu yazarken tutulur.
PX_SEMA = {'type': 'object', 'additionalProperties': False, 'required': ['nesne', 'satirlar'],
           'properties': {'nesne': {'type': 'string'}, 'satirlar': {'type': 'array', 'items': {'type': 'string'}}}}
PX_ORNEK = ("Örnek, bavul:\n............\n....kkkk....\n....k..k....\n.kkkkkkkkkk.\n.kbbbbbbbbk.\n.kaaaaaaaak.\n"
            ".kkkkcckkkk.\n.kaaaccaaak.\n.kaaaaaaaak.\n.kaaaaaaaak.\n.kkkkkkkkkk.\n............\n"
            "Örnek, ampul:\n....kkkk....\n...kbbaak...\n..kbbaaaak..\n..kbaaaaak..\n..kaaaaaak..\n...kaaaak...\n"
            "....kaak....\n....kkkk....\n....kcck....\n....kkkk....\n.....kk.....\n............")
PX_TALIMATI = ("Sen Beyin adlı ikinci beyin programının ikon çizerisin. Önce adı tek, somut, tanınır bir nesneye çevir ve 'nesne'ye "
               "yaz (örnek: Satış → yükselen çubuk grafik, Günlük → açık defter, Kişisel → filiz, Müşteriler → iki kişi). Sonra o "
               "nesneyi 12×12 pixel art çiz: tam 12 satır, her satır tam 12 karakter. Karakterler: '.' boş, 'k' koyu kontur, "
               "'a' ana renk, 'b' açık ton, 'c' sıcak vurgu. Kurallar: siluet 16 pikselde okunsun; nesne 8-10 piksel genişliğinde, "
               "ortada, kenarda en az bir piksel boşluk; bir piksel kalınlığında kapalı 'k' konturu, içi 'a'; ışık üst-soldan, "
               "orada birkaç 'b'; 'c' yalnız 1-4 piksellik vurgu; doğası simetrikse simetrik çiz; tek kalmış piksel, gürültü, "
               "desen, harf ya da yazı yok. Dosya okuma, araç kullanma.\n" + PX_ORNEK)
ikon_kilit = threading.Lock()
ikon_kuyruk = []
IKON_CIZILIYOR = set()


def _px_hedef(c, ca_id, alan_id):
    ca = next(x for x in c['calisma_alanlari'] if x['id'] == ca_id)
    return ca, (next(a for a in ca['alanlar'] if a['id'] == alan_id) if alan_id else ca)


def px_duzelt(px):
    """Modelin ızgarasını 12×12'ye oturtur; bilinmeyen karakter boş olur. Konturu ve ana rengi olmayan çizim geçersiz."""
    if not isinstance(px, list) or len(px) < 10:
        return None
    satirlar = [re.sub(r'[^.kabc]', '.', str(r))[:12].ljust(12, '.') for r in px[:12]]
    satirlar += ['.' * 12] * (12 - len(satirlar))
    hepsi = ''.join(satirlar)
    return satirlar if hepsi.count('k') >= 8 and hepsi.count('a') >= 4 else None


def ikon_ciz_sirala(istek):
    """/api/ikon-ciz {calisma, alan?, tarif?}: çizimi sıraya koyar, hemen döner; durum /api/ikon-durum."""
    _px_hedef(calisma_oku(), istek['calisma'], istek.get('alan'))  # yoksa StopIteration: 404
    anahtar = istek['calisma'] + ':' + (istek.get('alan') or '')
    with ikon_kilit:
        if anahtar not in IKON_CIZILIYOR and all(k[0] != anahtar for k in ikon_kuyruk):
            ikon_kuyruk.append((anahtar, istek['calisma'], istek.get('alan') or '', str(istek.get('tarif') or '').strip()[:120]))
        if not getattr(_ikon_dongu, 'calisiyor', False):
            _ikon_dongu.calisiyor = True
            threading.Thread(target=_ikon_dongu, daemon=True).start()
    return anahtar


def alan_durum():
    """/api/alan-durum: alan başına son değişiklik (epoch: Defter, Bilgi, notlar, kaynaklar, panolar), Codex'in o an hangi alanda
    ne yaptığı, süren videolar ve çizilen ikonlar. Kenar listesi ve Canlı bölümü bunu okur."""
    def zaman_(y):
        try:
            return os.path.getmtime(y)
        except OSError:
            return 0
    c, boards, son = calisma_oku(), canvas_oku().get('boards', {}), {}
    for ca in c['calisma_alanlari']:
        for a in ca['alanlar']:
            yerler = [os.path.join(BEYIN, 'sayfalar', a['id']), os.path.join(NOTLAR, a['id']), os.path.join(KAYNAK, ca['id'], a['id'])]
            t = [zaman_(os.path.join(k, f)) for k in yerler if os.path.isdir(k) for f in os.listdir(k) if not f.startswith('.')]
            t += [zaman_(os.path.join(PROJE, ad)) for ad, b in boards.items() if b.get('page') == a.get('sayfa')]
            son[a['id']] = round(max(t or [0]))
    codex = [{'alan': alan, **KOPRU.son_is.get(k.get('thread'), {'is': 'Düşünüyor', 'yol': ''})}
             for alan, k in KOPRU.gorevler.items() if k.get('thread') in KOPRU.aktif_tur]
    videolar = [{'alan': v['alan'], 'asama': v['asama'], 'baslik': v.get('baslik', '')} for v in videolar_oku() if v['asama'] not in ('bitti', 'hata')]
    with defter_kilit:
        geri = list(DEFTER_GERI)
    return {'son': son, 'codex': codex, 'videolar': videolar, 'ikon': ikon_durum(), 'defter_geri': geri,
            'dogrula': sum(k['durum'] == 'bekliyor' for k in dogrula_oku())}


def ikon_durum():
    with ikon_kilit:
        return {'ciziliyor': sorted(IKON_CIZILIYOR), 'sirada': [k[0] for k in ikon_kuyruk]}


def _ikon_dongu():
    while True:
        with ikon_kilit:
            if not ikon_kuyruk:
                _ikon_dongu.calisiyor = False
                return
            anahtar, ca_id, alan_id, tarif = ikon_kuyruk.pop(0)
            IKON_CIZILIYOR.add(anahtar)
        try:
            _ikon_ciz(ca_id, alan_id, tarif)
        except Exception as e:  # bir ikonun hatası kuyruğu durdurmaz
            print('ikon çizilemedi:', anahtar, str(e)[:120], flush=True)
        finally:
            with ikon_kilit:
                IKON_CIZILIYOR.discard(anahtar)


def _ikon_ciz(ca_id, alan_id, tarif):
    ca, h = _px_hedef(calisma_oku(), ca_id, alan_id)
    metin = (f"Ad: {h['ad']}\n" + (f"Bağlam: '{ca['ad']}' çalışma alanının bir alanı.\n" if alan_id else
             'Bağlam: bir çalışma alanı, içinde birçok alan var.\n') + (f"İpucu emoji: {h['ikon']}\n" if h.get('ikon') else '')
             + (f'Kullanıcının tarifi: {tarif}\n' if tarif else ''))
    px = None
    for _ in range(2):  # ana model, orta düşünme: küçük model okunur siluet çizemedi (ölçüldü, 2026-10-04)
        try:
            px = px_duzelt(json.loads(KOPRU.tek_tur(PX_TALIMATI, [], metin, PX_SEMA, None, 'medium', 240)).get('satirlar'))
        except (ValueError, RuntimeError, AttributeError):
            px = None
        if px:
            break
    if not px:
        return
    with kilit:
        c = calisma_oku()
        try:
            _, h = _px_hedef(c, ca_id, alan_id)
        except StopIteration:
            return  # bu arada kaldırıldı
        h['ikon_px'] = px
        calisma_yaz(c)


def kimlik_degis(istek):
    """Çalışma alanına ya da alana emoji, renk (yalnız çalışma alanında) ve ad. Boş ikon kaldırır. Ad değişince kimlik aynı kalır;
    alanın tuval sayfası, Defter ve Bilgi başlığı da yeni adı alır (K-060, K-061)."""
    c = calisma_oku()
    ca = next(x for x in c['calisma_alanlari'] if x['id'] == istek['calisma'])
    hedef = next(a for a in ca['alanlar'] if a['id'] == istek['alan']) if istek.get('alan') else ca
    if 'ad' in istek:
        ad = str(istek['ad'] or '').strip()
        if not ad or len(ad) > 60:
            raise ValueError('ad 1 ile 60 karakter olmalı')
        eski, hedef['ad'] = hedef['ad'], ad
        if istek.get('alan'):
            tuval = canvas_oku()
            for p in tuval.get('pages', []):
                if p['id'] == hedef.get('sayfa'):
                    p['name'] = ad
            canvas_yaz(tuval)
            for s_ in sayfalar.liste(BEYIN, hedef['id']):
                yeni = {eski: ad, eski + ' · Bilgi': ad + ' · Bilgi'}.get(s_.get('title'))
                if yeni:
                    sayfalar.yaz(BEYIN, {'id': s_['id'], 'title': yeni})
    if 'ikon' in istek:
        ikon = str(istek['ikon'] or '').strip()
        if len(ikon) > 8:
            raise ValueError('ikon tek emoji olmalı')
        hedef.pop('ikon', None) if not ikon else hedef.update(ikon=ikon)
    if 'renk' in istek and not istek.get('alan'):
        if istek['renk'] not in RENKLER:
            raise ValueError('bilinmeyen renk')
        ca['renk'] = istek['renk']
    calisma_yaz(c)
    return True


def alan_tasi(istek):
    """Alanı başka çalışma alanına taşır (K-060, K-061): verisi ham/kaynaklar/<yeni>/ altına, video kayıtları da; kimlik aynı."""
    c = calisma_oku()
    eski = next(x for x in c['calisma_alanlari'] if any(a['id'] == istek['alan'] for a in x['alanlar']))
    yeni = next(x for x in c['calisma_alanlari'] if x['id'] == istek['hedef'])
    if eski is yeni:
        return yeni['id']
    a = next(a for a in eski['alanlar'] if a['id'] == istek['alan'])
    kaynak, hedef = os.path.join(KAYNAK, eski['id'], a['id']), os.path.join(KAYNAK, yeni['id'], a['id'])
    if os.path.exists(hedef):
        raise ValueError('hedefte aynı adda veri klasörü var')
    if os.path.isdir(kaynak):
        os.makedirs(os.path.dirname(hedef), exist_ok=True)
        shutil.move(kaynak, hedef)
    with video_kilit:
        liste = videolar_oku()
        for v in liste:
            if v.get('alan') == a['id']:
                v['calisma'] = yeni['id']
        videolar_yaz(liste)
    eski['alanlar'].remove(a)
    yeni['alanlar'].append(a)
    calisma_yaz(c)
    return yeni['id']


def calisma_sira(istek):
    """Ayarlar › Çalışma alanları (K-060): görünen çalışma alanlarının sırası; gizliler yerinde kalır."""
    c = calisma_oku()
    mevcut = {x['id']: x for x in c['calisma_alanlari'] if not x.get('gizli')}
    sira = list(istek['sira'])
    if sorted(sira) != sorted(mevcut):
        raise ValueError('sıra çalışma alanlarıyla aynı değil')
    gizli = [x for x in c['calisma_alanlari'] if x.get('gizli')]
    c['calisma_alanlari'] = [mevcut[i] for i in sira] + gizli
    calisma_yaz(c)
    return True


# Entegrasyonlar (K-065): Codex, GitHub, Obsidian, video araçları, hafıza. Durum 60 sn önbellekte (alt süreçler yavaş).
# durum: bagli, yarim (kurulu ama bu beyne bağlı değil), uyari (çalışıyor ama dışarıdan), yok.
ENT_ONBELLEK = {'zaman': 0, 'veri': None}


def _komut(args, sure=8):
    try:
        r = subprocess.run(args, cwd=BEYIN, capture_output=True, text=True, timeout=sure)
        return r.returncode, (r.stdout + r.stderr).strip()
    except (OSError, subprocess.TimeoutExpired):
        return -1, ''


def entegrasyonlar(tazele=False):
    if not tazele and ENT_ONBELLEK['veri'] and zaman.time() - ENT_ONBELLEK['zaman'] < 60 and ENT_ONBELLEK.get('github') != 'gonderiliyor':
        return ENT_ONBELLEK['veri']
    sonuc = []
    kod, surum = _komut(['codex', '--version'])
    bagli = KOPRU.calisiyor() and not KOPRU.hata
    sonuc.append({'ad': 'codex', 'baslik': 'Codex', 'durum': 'bagli' if bagli and kod == 0 else 'uyari' if kod == 0 else 'yok',
                  'ozet': 'Bağlı' if bagli else 'Köprü kapalı' if kod == 0 else 'Kurulu değil',
                  'aciklama': (surum.splitlines()[0] if kod == 0 else 'codex komutu bulunamadı') + f" · {len(KOPRU.gorevler)} alan konuşması",
                  'ayrinti': KOPRU.hata or 'hata yok', 'eylem': ['kontrol', 'Kontrol et']})
    kod_gh, gh = _komut(['gh', 'auth', 'status'])
    hesap = re.search(r'account (\S+)', gh)
    _, uzak = _komut(['git', 'remote', '-v'])
    gh_uzak = re.search(r'github\.com[:/]([^\s]+?)(?:\.git)?\s', uzak + ' ')
    if gh_uzak:
        g = {'durum': 'bagli', 'ozet': 'Bağlı', 'aciklama': f'{gh_uzak.group(1)} deposuna yedekleniyor', 'ayrinti': 'git remote: ' + gh_uzak.group(1), 'eylem': ['github-ac', "GitHub'da aç"]}
    elif kod_gh == 0:
        g = {'durum': 'yarim', 'ozet': 'Giriş var, repo bağlı değil', 'aciklama': f'{hesap.group(1) if hesap else "hesap"} olarak girişli; bu beyin henüz yedeklenmiyor',
             'ayrinti': 'uzak depo yok · git remote boş', 'eylem': ['github-bagla', 'Private repoya bağla']}
    else:
        g = {'durum': 'yok', 'ozet': 'Giriş yok', 'aciklama': 'gh kurulu değil ya da giriş yapılmamış', 'ayrinti': 'Terminalde: gh auth login', 'eylem': None}
    if ENT_ONBELLEK.get('github') == 'gonderiliyor':
        g.update(durum='yarim', ozet='Gönderiliyor…', eylem=None)
    elif str(ENT_ONBELLEK.get('github', '')).startswith('hata'):
        g.update(ayrinti=ENT_ONBELLEK['github'])
    sonuc.append({'ad': 'github', 'baslik': 'GitHub', **g})
    kurulu = os.path.isdir('/Applications/Obsidian.app')
    kasa = os.path.isdir(os.path.join(BEYIN, '.obsidian'))
    sonuc.append({'ad': 'obsidian', 'baslik': 'Obsidian', 'durum': 'bagli' if kurulu and kasa else 'yarim' if kurulu else 'yok',
                  'ozet': 'Kasa açık' if kasa else 'Kurulu, kasa açılmadı' if kurulu else 'Kurulu değil',
                  'aciklama': 'Notlar Markdown; bu klasör Obsidian kasası olarak açılabilir', 'ayrinti': '.obsidian klasörü ' + ('var' if kasa else 'yok'),
                  'eylem': ['obsidian-ac', "Obsidian'da aç"] if kurulu else None})
    arac = video_araci()
    tam = all(os.path.exists(os.path.join(arac, a)) for a in ('yt-dlp', 'mlx_whisper')) and bool(shutil.which('ffmpeg'))
    disarida = not os.path.realpath(arac).startswith(os.path.realpath(BEYIN))
    sonuc.append({'ad': 'video', 'baslik': 'Video araçları', 'durum': ('uyari' if disarida else 'bagli') if tam else 'yok',
                  'ozet': ('Çalışıyor, dışarıdan' if disarida else 'Çalışıyor') if tam else 'Eksik',
                  'aciklama': 'yt-dlp, whisper, ffmpeg' + ('; eski global klasörden, `sh araclar/video-kur.sh` Beyin\'e alır' if disarida else '; Beyin\'in kendi klasöründe'),
                  'ayrinti': arac.replace(os.path.expanduser('~'), '~'), 'eylem': ['video-mantik', 'Nasıl çalışıyor']})
    try:
        av = open(os.path.join(BEYIN, '.beyin-version'), encoding='utf-8').read().strip()
    except OSError:
        av = ''
    sonuc.append({'ad': 'hafiza', 'baslik': 'Hafıza', 'durum': 'bagli' if av else 'yok', 'ozet': 'Bağlı' if av else 'Kurulu değil',
                  'aciklama': f'V3 {av} · yerel indeks' if av else 'beyin.py bulunamadı', 'ayrinti': 'Sağlık: beyin.py doctor', 'eylem': ['hafiza-saglik', 'Sağlık']})
    ENT_ONBELLEK.update(zaman=zaman.time(), veri=sonuc)
    return sonuc


def entegrasyon_eylem(istek):
    """Ayarlar › Entegrasyonlar düğmeleri. github-bagla dışarıya gönderir: yalnız kullanıcının iki adımlı onayıyla, private."""
    is_ = istek.get('is')
    if is_ == 'kontrol':
        return entegrasyonlar(True)
    if is_ == 'obsidian-ac':
        subprocess.Popen(['open', 'obsidian://open?path=' + BEYIN])
        return True
    if is_ == 'github-bagla':
        ad = str(istek.get('depo') or '').strip()
        if not re.fullmatch(r'[A-Za-z0-9._-]{1,80}', ad):
            raise ValueError('depo adı harf, rakam, nokta, tire olmalı')
        if ENT_ONBELLEK.get('github') == 'gonderiliyor':
            raise ValueError('gönderim sürüyor')

        def gonder_():  # kilidi tutmadan arka planda; durum entegrasyon listesine iner
            kod, cikti = _komut(['gh', 'repo', 'create', ad, '--private', '--source', BEYIN, '--remote', 'origin', '--push'], 600)
            ENT_ONBELLEK.update(github='' if kod == 0 else 'hata: ' + (cikti.splitlines()[-1][:120] if cikti else 'depo açılamadı'), veri=None)
        ENT_ONBELLEK.update(github='gonderiliyor', veri=None)
        threading.Thread(target=gonder_, daemon=True).start()
        return 'basladi'
    if is_ == 'hafiza-saglik':
        _, doktor = _komut([sys.executable, os.path.join(BEYIN, 'beyin.py'), 'doctor', '--human'], 30)
        return doktor
    raise ValueError('bilinmeyen eylem')


GUNCELLE_KILIT = threading.Lock()


def gelistirici_kopya():
    """Programın kaynağı olan kopya (yayınlayıcı burada): güncelleme kurulmaz, yayınlanır."""
    return os.path.exists(os.path.join(BEYIN, 'araclar', 'yayinla.py'))


def surum_bilgisi(zorla=False):
    """Ayarlar › Program › Sürüm: kurulu sürüm, GitHub'daki son sürüm (günde bir kez, "Güncellemeleri kontrol et" ile hemen)
    ve son güncellemenin kaydı (çakışan dosyalar, geri alma)."""
    return {**guncelle.kontrol(BEYIN, zorla), 'gelistirici': gelistirici_kopya(), 'son_is': guncelle.son_is(BEYIN)}


def alan_sira(istek):
    """Liste A (K-045): çalışma alanının alanlarını kullanıcının sürüklediği sıraya koyar; eksik ya da fazla kimlik reddedilir."""
    c = calisma_oku()
    ca = next(x for x in c['calisma_alanlari'] if x['id'] == istek['calisma'])
    mevcut = {a['id']: a for a in ca['alanlar']}
    sira = list(istek['sira'])
    if sorted(sira) != sorted(mevcut):
        raise ValueError('sıra alanlarla aynı değil')
    ca['alanlar'] = [mevcut[i] for i in sira]
    calisma_yaz(c)
    return True


def alan_kaldir(istek):
    """Alanı her şeyiyle çöpe taşır (K-055): Defter ve sayfaları, kararları ve soruları, verisi, tuvalindeki panolar ve
    öğeler. Hiçbir şey silinmez; Çöp'ten geri yüklenince hepsi yerine döner, kalıcı silmede pano dosyaları ve veri de gider."""
    c = calisma_oku()
    ca = next(x for x in c['calisma_alanlari'] if any(a['id'] == istek['alan'] for a in x['alanlar']))
    a = next(a for a in ca['alanlar'] if a['id'] == istek['alan'])
    no = zaman.strftime('%Y%m%d%H%M%S') + '-alan'
    klasor, tasinan = os.path.join(BEYIN, 'sayfalar', a['id']), []
    if os.path.isdir(klasor):
        os.makedirs(COP, exist_ok=True)
        for ad in os.listdir(klasor):
            os.replace(os.path.join(klasor, ad), os.path.join(COP, ad))
            tasinan.append(ad[:-3]) if ad.endswith('.md') else None
        os.rmdir(klasor)
    ek = []  # kararlar, sorular ve veri sayfalar/.cop/<no>/ altında bekler
    for kaynak, ad in ((os.path.join(NOTLAR, a['id']), 'notlar'), (os.path.join(KAYNAK, ca['id'], a['id']), 'veri')):
        if os.path.isdir(kaynak) and any(os.scandir(kaynak)):
            os.makedirs(os.path.join(COP, no), exist_ok=True)
            shutil.move(kaynak, os.path.join(COP, no, ad))
            ek.append(ad)
        elif os.path.isdir(kaynak):
            os.rmdir(kaynak)
    tuval = canvas_oku()
    panolar = {k: b for k, b in tuval.get('boards', {}).items() if b.get('page') == a['sayfa']}
    ogeler = {k: n for k, n in tuval.get('notes', {}).items() if n.get('page') == a['sayfa']}
    for k in panolar:
        del tuval['boards'][k]
    for k in ogeler:
        del tuval['notes'][k]
    tuval['order'] = [k for k in tuval.get('order', []) if k not in panolar]
    tuval['pages'] = [x for x in tuval.get('pages', []) if x['id'] != a['sayfa']]
    canvas_yaz(tuval)
    cop_ekle({'no': no, 'tur': 'alan', 'calisma': ca['id'], 'calisma_ad': ca['ad'], 'alan': a, 'sayfalar': tasinan, 'ek': ek,
              'panolar': panolar, 'ogeler': ogeler, **({'grup': istek['grup']} if istek.get('grup') else {})})
    ca['alanlar'].remove(a)
    calisma_yaz(c)
    KOPRU.gorev_birak(a['id'])
    return ca['id']


def calisma_kaldir(istek):
    """Çalışma alanını alanlarıyla çöpe taşır (K-060); her alan K-055 gibi her şeyiyle gider, kayıtları çalışma alanına bağlıdır
    (grup), geri yüklenince birlikte döner. Gizli program alanı kaldırılmaz."""
    c = calisma_oku()
    ca = next(x for x in c['calisma_alanlari'] if x['id'] == istek['calisma'])
    if ca.get('gizli'):
        raise ValueError('program alanı kaldırılmaz')
    no = zaman.strftime('%Y%m%d%H%M%S') + '-calisma'
    for a in list(ca['alanlar']):
        alan_kaldir({'alan': a['id'], 'grup': no})
    c = calisma_oku()
    ca = next(x for x in c['calisma_alanlari'] if x['id'] == istek['calisma'])
    kaynak = os.path.join(KAYNAK, ca['id'])
    if os.path.isdir(kaynak) and not any(os.scandir(kaynak)):
        os.rmdir(kaynak)
    c['calisma_alanlari'].remove(ca)
    calisma_yaz(c)
    cop_ekle({'no': no, 'tur': 'calisma', 'calisma': ca['id'], 'calisma_ad': ca['ad'], 'bilgi': {**ca, 'alanlar': []}})
    return no  # bildirimdeki Geri al bu kaydı geri yükler (K-082)


# Çöp (K-032): kaldırılan alan ve çalışma alanları sayfalar/.cop/kaldirilanlar.json'da, Defter'leri yanında; geri yüklenir
COP = os.path.join(BEYIN, 'sayfalar', '.cop')
COP_KAYIT = os.path.join(COP, 'kaldirilanlar.json')


def cop_kayitlari():
    try:
        with open(COP_KAYIT, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


def cop_kayit_yaz(liste):
    os.makedirs(COP, exist_ok=True)
    with open(COP_KAYIT, 'w', encoding='utf-8') as f:
        json.dump(liste, f, ensure_ascii=False, indent=1)
        f.write('\n')


def cop_ekle(kayit):
    liste = cop_kayitlari()
    liste.insert(0, {'no': zaman.strftime('%Y%m%d%H%M%S') + '-' + kayit['tur'], 'zaman': zaman.strftime('%Y-%m-%dT%H:%M:%S'), **kayit})
    cop_kayit_yaz(liste)


def cop():
    """Çöpteki kayıtlar ve hiçbir kayda bağlı olmayan tek sayfalar (eski genel sayfalar gibi)."""
    kayitlar = cop_kayitlari()
    bagli = {sid for k in kayitlar for sid in k.get('sayfalar', [])}
    tekler = []
    for ad in sorted(os.listdir(COP)) if os.path.isdir(COP) else []:
        if ad.endswith('.md') and ad[:-3] not in bagli:
            with open(os.path.join(COP, ad), encoding='utf-8') as f:
                bilgi, govde = sayfalar._ayir(f.read())
            tekler.append({'id': ad[:-3], 'title': bilgi.get('title') or 'Başlıksız', 'alan': bilgi.get('alan') or '',
                           'zaman': zaman.strftime('%Y-%m-%dT%H:%M:%S', zaman.localtime(os.path.getmtime(os.path.join(COP, ad)))), 'boyut': len(govde.strip())})
    return {'kayitlar': kayitlar, 'sayfalar': sorted(tekler, key=lambda x: x['zaman'], reverse=True)}


def cop_geri(istek):
    """Kaydı geri yükler: alan eski çalışma alanına (yoksa Kişisel'e) Defter'iyle döner; tek sayfa Kişisel › Genel'in
    Defter'ine kendi başlığıyla eklenir."""
    c = calisma_oku()
    if istek.get('sayfa'):
        if not sayfalar.KIMLIK.match(istek['sayfa']) or not os.path.exists(os.path.join(COP, istek['sayfa'] + '.md')):
            raise ValueError('çöpte böyle sayfa yok')
        yol = os.path.join(COP, istek['sayfa'] + '.md')
        with open(yol, encoding='utf-8') as f:
            bilgi, govde = sayfalar._ayir(f.read())
        # Genel'e eklenir; Genel kaldırıldıysa Kişisel'in (yoksa ilk görünen çalışma alanının) ilk alanına
        adaylar = [(ca, a) for ca in c['calisma_alanlari'] if not ca.get('gizli') for a in ca['alanlar']]
        hedef, alan = next(((ca, a) for ca, a in adaylar if a['id'] == 'genel'), None) or next(((ca, a) for ca, a in adaylar if ca['id'] == 'kisisel'), None) \
            or (adaylar[0] if adaylar else (None, None))
        if not hedef:
            raise ValueError('geri yüklenecek alan yok')
        ana = sayfalar.ana_not(BEYIN, alan['id'], alan['ad'])
        ek = '## ' + (bilgi.get('title') or 'Geri yüklenen sayfa') + '\n\n' + govde.strip()
        sayfalar.yaz(BEYIN, {'id': ana['id'], 'title': ana['title'], 'govde': (ana['govde'].rstrip() + '\n\n' + ek).strip()})
        os.remove(yol)
        return {'calisma': hedef['id'], 'alan': alan['id']}
    liste = cop_kayitlari()
    kayit = next(k for k in liste if k['no'] == istek['no'])
    if kayit['tur'] == 'calisma':
        if any(ca['id'] == kayit['calisma'] for ca in c['calisma_alanlari']):
            raise ValueError('bu adda çalışma alanı var')
        c['calisma_alanlari'].append({**kayit['bilgi'], 'alanlar': []})
        hedef_ca, alan_id = kayit['calisma'], ''
    else:
        a = kayit['alan']
        if os.path.isdir(os.path.join(NOTLAR, a['id'])) or any(x['id'] == a['id'] for ca in c['calisma_alanlari'] for x in ca['alanlar']):
            raise ValueError('bu adda alan var')
        ca = next((x for x in c['calisma_alanlari'] if x['id'] == kayit['calisma']), None) or next(x for x in c['calisma_alanlari'] if x['id'] == 'kisisel')
        klasor = os.path.join(BEYIN, 'sayfalar', a['id'])
        os.makedirs(klasor, exist_ok=True)
        for sid in kayit.get('sayfalar', []):
            if os.path.exists(os.path.join(COP, sid + '.md')):
                os.replace(os.path.join(COP, sid + '.md'), os.path.join(klasor, sid + '.md'))
        for ad, hedef in (('notlar', os.path.join(NOTLAR, a['id'])), ('veri', os.path.join(KAYNAK, ca['id'], a['id']))):
            if ad in kayit.get('ek', []) and os.path.isdir(os.path.join(COP, kayit['no'], ad)) and not os.path.exists(hedef):
                os.makedirs(os.path.dirname(hedef), exist_ok=True)
                shutil.move(os.path.join(COP, kayit['no'], ad), hedef)
        shutil.rmtree(os.path.join(COP, kayit['no']), ignore_errors=True)
        tuval = canvas_oku()
        if not any(x['id'] == a['sayfa'] for x in tuval.get('pages', [])):
            tuval.setdefault('pages', []).append({'id': a['sayfa'], 'name': a['ad']})
        for k, b in kayit.get('panolar', {}).items():
            if k not in tuval.setdefault('boards', {}):
                tuval['boards'][k] = b
                tuval.setdefault('order', []).append(k)
        for k, n in kayit.get('ogeler', {}).items():
            tuval.setdefault('notes', {}).setdefault(k, n)
        canvas_yaz(tuval)
        ca['alanlar'].append(a)
        hedef_ca, alan_id = ca['id'], a['id']
    calisma_yaz(c)
    cop_kayit_yaz([k for k in liste if k is not kayit])
    for alt in [k for k in cop_kayitlari() if k.get('grup') == kayit['no']]:  # çalışma alanıyla giden alanlar da döner
        cop_geri({'no': alt['no']})
    return {'calisma': hedef_ca, 'alan': alan_id}


def cop_sil(istek):
    """Kalıcı siler: tek sayfa ya da kaydın çöpteki Defter'leri ve kaydın kendisi."""
    if istek.get('sayfa'):
        if not sayfalar.KIMLIK.match(istek['sayfa']):
            raise ValueError('sayfa kimliği geçersiz')
        os.remove(os.path.join(COP, istek['sayfa'] + '.md'))
        return True
    liste = cop_kayitlari()
    kayit = next(k for k in liste if k['no'] == istek['no'])
    for alt in [k for k in liste if k.get('grup') == kayit['no']]:  # çalışma alanıyla giden alanlar da kalıcı silinir
        cop_sil({'no': alt['no']})
        liste = cop_kayitlari()
    for sid in kayit.get('sayfalar', []):
        if sayfalar.KIMLIK.match(sid) and os.path.exists(os.path.join(COP, sid + '.md')):
            os.remove(os.path.join(COP, sid + '.md'))
    if re.fullmatch(r'[0-9]{14}-alan', kayit['no']):
        shutil.rmtree(os.path.join(COP, kayit['no']), ignore_errors=True)
    kullanilan = set(canvas_oku().get('boards', {}))
    for k in kayit.get('panolar', {}):
        if k not in kullanilan and re.fullmatch(r'[\w.-]+\.dc\.html', k) and os.path.exists(os.path.join(BEYIN, 'panolar', k)):
            os.remove(os.path.join(BEYIN, 'panolar', k))
    cop_kayit_yaz([k for k in liste if k['no'] != kayit['no']])  # liste yeniden okunmuş olabilir: nesneyle değil numarayla ayır
    return True


def izole_degis(istek):
    c = calisma_oku()
    ca = next(x for x in c['calisma_alanlari'] if x['id'] == istek['id'])
    ca['izole'] = bool(istek['izole'])
    calisma_yaz(c)
    return ca['izole']


def konusmalar():
    """ham/konusmalar/*.md: kaynak, ilk söz, mesaj sayısı; en yeni önce. Ortak katman: hiçbir çalışma alanına kilitli değil."""
    klasor = os.path.join(BEYIN, 'ham', 'konusmalar')
    sonuc = []
    for ad in os.listdir(klasor) if os.path.isdir(klasor) else []:
        if not ad.endswith('.md'):
            continue
        yol = os.path.join(klasor, ad)
        with open(yol, encoding='utf-8') as f:
            metin = f.read()
        basliklar = re.findall(r'^## (.+)$', metin, re.M)
        ilk = re.search(r'^## [^\n]* · Sen\n\n(.+)$', metin, re.M)
        sonuc.append({'ad': ad, 'yol': os.path.relpath(yol, BEYIN), 'kaynak': 'Codex' if '-codex-' in ad else 'Claude',
                      'mesaj': len(basliklar), 'sen': sum(1 for b in basliklar if '· Sen' in b),
                      'ilk': (ilk.group(1)[:140] if ilk else ''), 'zaman': os.path.getmtime(yol)})
    return sorted(sonuc, key=lambda k: -k['zaman'])


# Gizli program alanında (Beyin mimarisi) Codex programın kendisini geliştirir (K-028): hataları görür, kodu düzeltir, denetler
PROGRAM_GELISTIR = [
    "Bu alan programın kendisi: Beyin'in kodunu (motor/, araclar/, panolar/tema.css) geliştirebilir ve hatalarını düzeltebilirsin. "
    "Repo git'te, her değişiklik geri alınır; izin isteme.",
    "Hataları gör: `curl -s 'http://127.0.0.1:%d/api/hatalar'` (arayüz ve sunucu hataları, en yenisi sonda) ve `.durum/sunucu.log`." % PORT,
    "Kendi hızını gör (S-017): `curl -s 'http://127.0.0.1:%d/api/codex/olcum'` her turun süresi, ilk söze kadar geçen süre, adım ve "
    "araç sayısı, giden bağlam boyu; seviyeye göre ortanca. Hızlandırma önerirken bu sayılara dayan, önce ve sonra ölç." % PORT,
    "Değiştirdikten sonra denetle: JS için `node --check <dosya>`, Python için `python3 -m py_compile <dosya>`. Tarayıcı sınamaları "
    "(node araclar/duman.mjs, sayfa-duman.mjs) sandbox'ta çalışmaz: hangisini koşmak gerektiğini cevabında söyle.",
    "JS, HTML ve CSS değişikliği sayfa yenilenince gelir; Python değişikliği (motor/*.py) sunucu yeniden başlayınca: kullanıcıya "
    "Ayarlar'daki 'Yeniden başlat' düğmesini söyle, sen başlatma (turun kesilir). Commit'leme; ne değiştirdiğini kısaca yaz ve "
    "kararı BEYIN.md ile notlar/beyin-mimarisi/ altına kaydet. Kullanıcı verisine (notlar, sayfalar, ham/) program işi için dokunma.",
]
HATA_DOSYASI = os.path.join(DURUM, 'hatalar.jsonl')


def hata_yaz(kayit):
    """Arayüz ve sunucu hataları .durum/hatalar.jsonl'a; son 400 kayıt tutulur. Codex program alanında buradan görür."""
    satir = json.dumps({'zaman': time.strftime('%Y-%m-%dT%H:%M:%S'), **{k: str(v)[:2000] for k, v in kayit.items()}}, ensure_ascii=False)
    try:
        with open(HATA_DOSYASI, encoding='utf-8') as f:
            eski = f.read().splitlines()[-399:]
    except OSError:
        eski = []
    os.makedirs(DURUM, exist_ok=True)
    with open(HATA_DOSYASI, 'w', encoding='utf-8') as f:
        f.write('\n'.join(eski + [satir]) + '\n')
    return True


def hatalar(son=40):
    try:
        with open(HATA_DOSYASI, encoding='utf-8') as f:
            return [json.loads(x) for x in f.read().splitlines()[-son:] if x.strip()]
    except (OSError, ValueError):
        return []


def codex_talimati(alan):
    """Codex'in bu alandaki rolü ve sınırı. İzole çalışma alanında yalnız kendi dosyalarını okur (talimat; okuma engellenmez)."""
    if alan.startswith('sayfa-'):
        return sayfalar.talimat(BEYIN, alan[len('sayfa-'):])
    ca = next((c for c in calisma_oku()['calisma_alanlari'] if any(a['id'] == alan for a in c.get('alanlar', []))), None)
    alan_ad = next((a['ad'] for a in (ca or {}).get('alanlar', []) if a['id'] == alan), alan)
    satirlar = [
        f"Sen Beyin adlı yerel, görsel önce bir ikinci beyin programının Codex'isin. Kullanıcıyla '{(ca or {}).get('ad', '?')} › {alan_ad}' "
        "alanını tartışırsın: ikinci görüş, eleştiri, seçenekler. Türkçe, kısa ve somut yaz; em dash kullanma.",
        "Repo bu klasör. Şema BEYIN.md. Notlar notlar/<alan>/*.md (karar, soru, ilke, kaynak), "
        "panolar panolar/*.dc.html (biçim PANO.md), ortak ham kayıt ham/konusmalar/ ve ham/kaynaklar/.",
        *(PROGRAM_GELISTIR if (ca or {}).get('gizli') else [
            "Uygulama kodu yazma; burası düşünme alanı. Not ya da pano yazman gerekirse izin istemeden yaz: repo git'te, her şey geri alınır. "
            "Kullanıcı Beyin programının kendisinde (arayüz, hata, yeni özellik) değişiklik isterse bunu Ayarlar › Beyin mimarisi alanında "
            "istemesini söyle; programın kodu orada geliştirilir."]),
        "Muhakemeyle kendin karar ver. Belirsizlikte makul varsayımı seç, cevabında tek cümleyle söyle ve işe devam et; kullanıcı beğenmezse düzeltir. "
        "Soru (request_user_input aracı) yalnız iki durumda: geri dönüşü olmayan bir iş ya da sonucu tamamen kullanıcının zevkine bağlı bir seçim. "
        "Bir turda en çok bir soru; 'şunu da yapayım mı' diye sorma, yap.",
        f"Pano denetimi: `curl -s 'http://127.0.0.1:{PORT}/api/pano-denetle?ad=<Pano>.dc.html'` (sunucu tarayıcıyı kendisi açar, "
        "sonucu döner). `node araclar/pano.mjs` sandbox'ta çalışmaz; onun için izin isteme, bu adresi kullan.",
        "Veri yorumu (dosya, tablo, PDF, görsel, link, YouTube videosu) istenince .agents/skills/beyin-veri/SKILL.md'ye uy; ağ açık.",
        "Mesajla birlikte etiketli bloklar gelebilir. <kullanici>: hafızanın kimlik klasörü (ben/), kullanıcıyı tanı. <ilgili_notlar>: "
        "hafızanın yerel aramasının bulduğu kayıtlar, geçmiş kararları buradan hatırla. <cizim_modu>: o turda çiz. <pano>, <bolge>: tuvalde seçilen. "
        "<pano_eylemi>: seçimdeki hızlı eylemin istemi.",
        "Çizim modu kapalıyken pano çizmen istenirse de aynı yol. " + yerlestir_tarifi(next((a.get('sayfa') or 'page-' + a['id'] for a in (ca or {}).get('alanlar', []) if a['id'] == alan), '')),
        # Hafıza (S-017): AGENTS.md'deki genel protokolün Beyin oturumlarına özel, kısa hâli. Ölçüm: Codex her turda skill'i baştan
        # okuyup --help çalıştırıyor, receipt'i kendisi yazıyordu; çizim turunun yaklaşık üçte biri buna gidiyordu.
        "Bu klasör Beyin'in hafızası (V3). Bu oturumda hafıza işi kısadır ve AGENTS.md'deki genel kuralın yerine geçer: "
        "(1) Geçmiş zaten mesajla gelir (<kullanici>, <ilgili_notlar>); ben/ dosyalarını ve .agents/skills/beyin/SKILL.md'yi her turda "
        "okuma. Daha fazlası gerekirse tek komut yeter: `python3 beyin.py context \"<sorgu>\" --harness codex --limit 5 --budget-chars 4000 "
        "--no-sync` (izole alanda `--project <çalışma alanı>` ekle; JSON döner, records içinde source ve text). `--help` çalıştırma. "
        "(2) Receipt gönderme: tur bitince Beyin, yazdığın dosyalar ve son cevabınla kendisi gönderir; son cevabın bir iki cümleyle ne "
        "yaptığını söylesin. `beyin.py sync` çalıştırma, dosyaların updated_at satırını elle değiştirme: tur bitince Beyin eşitler. "
        "(3) Last-Session, Threads ve Journal'a yalnız kullanıcı isterse yaz. (4) Bilgi sayfasına ve panoya yazmak hafıza işi değildir, "
        "SKILL.md ve BEYIN.md okumak gerekmez (kuralı <yazma_kurali> ve çizim tarifi verir). SKILL.md'yi yalnız `beyin.py note-create` ile not, görev ya da "
        "Kurallar yazacağın turda oku. Kullanıcı hakkında öğrendiğin kalıcı tercihi "
        "knowledge/tercihler/<kisa-ad>.md olarak `beyin.py note-create` ile yaz (metadata: kind preference, validity current, visibility "
        "internal, created_at bugün); sormadan. ben/Core.md'ye yalnız kullanıcı açıkça kendisi hakkında bilgi verdiğinde ekle. "
        "validity: rejected olan tercihi yeniden yazma. Parola, anahtar gibi sırları hiçbir yere yazma. "
        f"Kullanıcının söylemediği, senin çıkardığın kalıcı bilgiyi (hedef, karar, tercih) kendin yazma, soruya bırak: `curl -s -X POST "
        f"http://127.0.0.1:{PORT}/api/dogrula-ekle -H 'Content-Type: application/json' -d '{{\"alan\":\"{alan}\",\"iddia\":\"<tek cümle>\","
        "\"hedef\":\"bilgi ya da tercih\",\"bolum\":\"<Bilgi başlığı>\"}'`; kullanıcı üstteki Codex düğmesinde onaylayınca Bilgi'ye ya da hafızaya yazılır. "
        "beyin.py için geçici JSON dosyalarını .durum/ altına yaz (sandbox içinde, git dışında); /tmp kullanma, onay ister.",
    ]
    if ca and ca.get('izole'):
        # Okuma sınırı kullanıcının verisi içindir: bu çalışma alanının notları, Defter ve Bilgi sayfaları, kaynakları ve tuval panoları.
        # Programın kendi dosyaları (şema, pano biçimi, skill'ler) her alanda okunur; yoksa Codex Bilgi'ye yazamaz, pano çizemez.
        alanlar = ', '.join(f"notlar/{a['id']}/, sayfalar/{a['id']}/" for a in ca.get('alanlar', []))
        tuval_sayfalari = ', '.join(a.get('sayfa') or 'page-' + a['id'] for a in ca.get('alanlar', []))
        satirlar.append(f"Bu çalışma alanı izole. Kaynak olarak yalnız şunları oku: {alanlar}, ham/kaynaklar/{ca['id']}/ ve panolar/ içinde "
                        f"canvas.json'da sayfası ({tuval_sayfalari}) olan panolar. Başka çalışma alanlarının notlarına, sayfalarına ve panolarına bakma. "
                        "Bu sınır kullanıcının verisi için: programın dosyaları (BEYIN.md, PANO.md, panolar/tema.css, panolar/arayuz.css, "
                        ".agents/skills/, araclar/) her zaman okunur. Bu alanın Bilgi sayfasına yazar, yeni panoyu çizim tarifindeki "
                        "<pano-yaz> bloğuyla verirsin (Beyin bu alanın sayfasına koyar); izin isteme. "
                        "Hafızaya yazdığın not ve sonuçlar bu alanın klasörüne gider (ortak beyin onları da görür), ama kaynak olarak "
                        f"yalnız bu çalışma alanını kullan: arama gerekirse `beyin.py context \"...\" --project {ca['id']}`. ben/Core.md ve "
                        "ben/Kurallar.md okunabilir; Last-Session, Threads ve başka alanların notları bu alanın kaynağı değildir.")
    return '\n'.join(satirlar)


def alan_bul(alan):
    for ca in calisma_oku()['calisma_alanlari']:
        for a in ca.get('alanlar', []):
            if a['id'] == alan:
                return ca, a
    return None, None


def izin_profili(alan):
    """İzole çalışma alanının Codex'i için izin profili (K-079): başka çalışma alanlarının verisi, bütün konuşma arşivi, iş
    kayıtları ve başka işleri taşıyan oturum dosyaları sandbox'ta okunamaz (yalnız talimat değil, macOS sandbox'ı engeller).
    Program dosyaları (BEYIN.md, PANO.md, tema, kit, skill'ler, motor/, araclar/) açık kalır. İzole değilse ya da program alanıysa None."""
    ca, _ = alan_bul(alan)
    if not ca or not ca.get('izole') or ca.get('gizli'):
        return None
    kendi = {a['id'] for a in ca.get('alanlar', [])}
    sayfalar_ = {a.get('sayfa') or 'page-' + a['id'] for a in ca.get('alanlar', [])}
    yasak = []
    for kok in ('notlar', 'sayfalar'):
        d = os.path.join(BEYIN, kok)
        yasak += [os.path.join(d, x) for x in (sorted(os.listdir(d)) if os.path.isdir(d) else []) if x not in kendi and os.path.isdir(os.path.join(d, x))]
    ham = os.path.join(BEYIN, 'ham')
    for x in sorted(os.listdir(ham)) if os.path.isdir(ham) else []:
        if x != 'kaynaklar':
            yasak.append(os.path.join(ham, x))
    kaynak = os.path.join(ham, 'kaynaklar')
    yasak += [os.path.join(kaynak, x) for x in (sorted(os.listdir(kaynak)) if os.path.isdir(kaynak) else []) if x != ca['id']]
    yasak += [os.path.join(BEYIN, y) for y in ('receipts', 'daily', '.git', 'ben/Last-Session.md', 'ben/Threads.md', 'ben/Journal.md', 'ben/Arşiv',
                                                'knowledge/index.md', 'knowledge/v3', 'calisma.json', '.beyin-projects.json', '.durum/codex-defter',
                                                '.durum/pano-surum', '.durum/dogrulama.json', '.durum/codex-gorevler.json', '.durum/codex-olcum.jsonl')]
    yasak.append(os.path.join(PROJE, 'canvas.json'))
    yasak += [os.path.join(PROJE, ad) for ad, b in sorted(canvas_oku().get('boards', {}).items()) if b.get('page') not in sayfalar_]
    for kok_, _, dosyalar in os.walk(os.path.join(BEYIN, 'knowledge')):  # başka çalışma alanına yazılmış bilgi notları
        for f in dosyalar:
            if f.endswith('.md'):
                try:
                    with open(os.path.join(kok_, f), encoding='utf-8') as d:
                        m = re.search(r'"project":\s*"([^"]+)"', d.read(600))
                except OSError:
                    continue
                if m and m.group(1) != ca['id']:
                    yasak.append(os.path.join(kok_, f))
    fs = {}
    for y in yasak:
        fs[y] = 'deny'
        if os.path.isdir(y):
            fs[y + '/**'] = 'deny'
    durum = oturum_ayari_durum()
    if durum:
        fs[durum] = 'write'  # hafıza indeksi: note-create ve arama
    return {'extends': ':workspace', 'filesystem': fs, 'network': {'enabled': True}}


def oturum_ayari_durum():
    try:
        with open(os.path.join(BEYIN, '.beyin-runtime.json'), encoding='utf-8') as f:
            return json.load(f).get('state')
    except (OSError, ValueError):
        return None


def gizli_haric(ca_id=None):
    """Gizli program alanı (Ayarlar'dan açılır) başka yerlerin bağlamına girmez: klasörleri ve proje adları."""
    gizli = [c for c in calisma_oku()['calisma_alanlari'] if c.get('gizli') and c['id'] != ca_id]
    klasor = tuple(y for c in gizli for y in [f"notlar/{a['id']}/" for a in c.get('alanlar', [])] + [f"ham/kaynaklar/{c['id']}/"])
    return klasor, tuple(c['id'] for c in gizli)


def sayfa_tuvali(istek):
    """Sayfanın çizim sekmesi: tuvalde kendi sayfası yoksa açılır."""
    s = sayfalar.oku(BEYIN, istek['id'])
    sayfa_id = sayfalar.tuval_sayfasi(s['id'])
    t, ad = canvas_oku(), s['title'] or 'Başlıksız'
    var = next((p for p in t.get('pages', []) if p['id'] == sayfa_id), None)
    if not var:
        t.setdefault('pages', []).append({'id': sayfa_id, 'name': ad})
        canvas_yaz(t)
    elif var.get('name') != ad:
        var['name'] = ad
        canvas_yaz(t)
    return sayfa_id


def sayfa_sil(istek):
    """Sayfa çöpe gider; tuvaldeki çizim sayfası boşsa o da kalkar (pano varsa çizim kaybolmasın diye kalır); Codex görevi düşer."""
    sonuc = sayfalar.sil(BEYIN, istek)
    KOPRU.gorev_birak('sayfa-' + istek['id'])
    sayfa_id, t = sayfalar.tuval_sayfasi(istek['id']), canvas_oku()
    if not any(b.get('page') == sayfa_id for b in t.get('boards', {}).values()) and any(p['id'] == sayfa_id for p in t.get('pages', [])):
        t['pages'] = [p for p in t['pages'] if p['id'] != sayfa_id]
        canvas_yaz(t)
    return sonuc


def sayfa_bloku(kimlik):
    """Codex'e giden <sayfa> bloğu: kullanıcının yazdığı notun son hali (sayfanın ya da alanın notu)."""
    s = sayfalar.oku(BEYIN, kimlik)
    yol = os.path.relpath(sayfalar._yol(BEYIN, kimlik), BEYIN)
    return (f"<sayfa>\nKullanıcının notu, şu anki hali: {yol} · {json.dumps(s['title'] or 'Başlıksız', ensure_ascii=False)}"
            f"\n\n{s['govde'][:6000]}\n</sayfa>")


def sayfa_yaz(istek):
    """Sayfa aç ya da güncelle. Alana açılan ilk sayfa klasörü kurarsa izolasyon eşlemesi yenilenir (K-027)."""
    alan = '' if istek.get('id') or istek.get('parent') else (istek.get('alan') or '')
    if alan and not alan_bul(alan)[1]:
        raise ValueError('alan yok')
    yeni = bool(alan) and not os.path.isdir(os.path.join(BEYIN, sayfalar.KLASOR, alan))
    s = sayfalar.yaz(BEYIN, istek)
    if yeni:
        hafiza.projeleri_yaz(BEYIN, calisma_oku())
    return s


def alan_notu(istek):
    """Alanın ana notu (yoksa açılır) ve alt notları. Klasör ilk kez açıldıysa izolasyon eşlemesi yenilenir."""
    ca, a = alan_bul(istek['alan'])
    if not a:
        raise ValueError('alan yok')
    yeni = not os.path.isdir(os.path.join(BEYIN, sayfalar.KLASOR, a['id']))
    s = sayfalar.ana_not(BEYIN, a['id'], a['ad'])
    if yeni:
        hafiza.projeleri_yaz(BEYIN, calisma_oku())
    return {**s, 'altlar': [x for x in sayfalar.liste(BEYIN, a['id']) if not x['ana'] and not x['bilgi']]}


def alan_bilgi(istek):
    """Alanın Bilgi sayfası (K-038): Codex yazar, kullanıcı okur; yoksa açılır."""
    ca, a = alan_bul(istek['alan'])
    if not a:
        raise ValueError('alan yok')
    return sayfalar.bilgi_not(BEYIN, a['id'], a['ad'])


def yazma_kurali(alan):
    """Her turda Codex'e giden kural (K-038): Defter kullanıcınındır, Codex'in çıktısı Bilgi sayfasına."""
    ca, a = alan_bul(alan)
    if not a:
        return ''
    defter = os.path.relpath(sayfalar._yol(BEYIN, sayfalar.ana_not(BEYIN, a['id'], a['ad'])['id']), BEYIN)
    bilgi = os.path.relpath(sayfalar._yol(BEYIN, sayfalar.bilgi_not(BEYIN, a['id'], a['ad'])['id']), BEYIN)
    return (f"<yazma_kurali>\nDefter ({defter}) kullanıcınındır: kendiliğinden yazma, değiştirme, ekleme; yalnız kullanıcı bu mesajda açıkça "
            f"\"Defter'e yaz\" derse; izinsiz değişiklik turun sonunda kendiliğinden geri alınır. Bütün çıktın (özet, kümeler, veri yorumu, değerlendirme, araştırma) alanın Bilgi sayfasına gider: "
            f"{bilgi}. Bilgi'yi ## başlıklarla bölünmüş, kaynaklı ve güncel tut; eskiyeni düzelt, tekrarı birleştir. Ön bilgiyi (--- arası) koru.\n</yazma_kurali>")


# Defter kilidi (K-066, K-038'in zorunlu hâli): Codex turu Defter'e kendiliğinden dokunamaz. Tur başlarken alanın Defter
# dosyaları (ana not ve alt notlar; Bilgi hariç) kopyalanır; tur sürerken sunucunun kendi yazdığı her sayfa (kullanıcının
# kaydı, öğreticinin işareti, ad değişikliği) kopyayı tazeler. Tur bitince dosya kopyadan farklıysa farkı Codex yapmıştır:
# Codex'in hâli .durum/codex-defter/'e yedeklenir, Defter kopyadan geri yazılır, kabuk /api/alan-durum'dan haber verir.
# Kullanıcı mesajında açıkça "Defter'e yaz" (ekle, düzenle, güncelle) derse o turda kilit kurulmaz.
DEFTER_KILIDI, DEFTER_GERI, defter_kilit = {}, [], threading.Lock()  # thread -> {alan, dosyalar: {yol: metin}}; son geri almalar
DEFTER_IZNI = re.compile(r"defter\S*(?:(?!değil|degil|bilgi)[^.,;!?\n]){0,40}?(yaz|ekle|düzenle|duzenle|işle|isle|güncelle|guncelle|değiştir|degistir|koy)(?!ma|me)")


def defter_dosyalari(alan):
    yollar = [os.path.join(BEYIN, sayfalar.KLASOR, alan, x['id'] + '.md') for x in sayfalar.liste(BEYIN, alan) if not x['bilgi']]
    sonuc = {}
    for y in yollar:
        try:
            with open(y, encoding='utf-8') as f:
                sonuc[y] = f.read()
        except OSError:
            pass
    return sonuc


def defter_kilidi_kur(alan, thread, metin, dosyalar):
    """Tur başı: kopya (gonder'den önce alınır) thread'e bağlanır; süren turun kopyası korunur, izinli mesajda kilit yok."""
    if DEFTER_IZNI.search(str(metin or '').replace('İ', 'i').lower()):
        with defter_kilit:
            DEFTER_KILIDI.pop(thread, None)
        return
    with defter_kilit:
        DEFTER_KILIDI.setdefault(thread, {'alan': alan, 'dosyalar': dosyalar})


def defter_kopyasi_tazele(yol):
    """sayfalar._yaz'dan: sunucunun yazdığı sayfa Codex'in değil, kopya yeni hâli alır."""
    with defter_kilit:
        kilitler = [k for k in DEFTER_KILIDI.values() if yol in k['dosyalar']]
    if not kilitler:
        return
    try:
        with open(yol, encoding='utf-8') as f:
            metin = f.read()
    except OSError:
        return
    with defter_kilit:
        for k in kilitler:
            k['dosyalar'][yol] = metin


def defter_denetle(thread):
    """Tur sonu: Codex'in değiştirdiği Defter dosyası yedeğe alınır ve kopyadan geri yazılır."""
    with defter_kilit:
        k = DEFTER_KILIDI.pop(thread, None)
    if not k:
        return
    for yol, eski in k['dosyalar'].items():
        try:
            with open(yol, encoding='utf-8') as f:
                simdi = f.read()
        except OSError:
            simdi = None
        if simdi == eski:
            continue
        yedek = ''
        if simdi is not None:
            yedek = os.path.join(BEYIN, '.durum', 'codex-defter', f"{os.path.basename(yol)[:-3]}-{time.strftime('%Y%m%d-%H%M%S')}.md")
            os.makedirs(os.path.dirname(yedek), exist_ok=True)
            with open(yedek, 'w', encoding='utf-8') as f:
                f.write(simdi)
        gecici = yol + '.geri.yaziliyor'
        with open(gecici, 'w', encoding='utf-8') as f:
            f.write(eski)
        os.replace(gecici, yol)
        with defter_kilit:
            no = (DEFTER_GERI[-1]['no'] + 1) if DEFTER_GERI else int(time.time())
            DEFTER_GERI.append({'no': no, 'alan': k['alan'], 'zaman': int(time.time()), 'dosya': os.path.relpath(yol, BEYIN),
                                'yedek': os.path.relpath(yedek, BEYIN) if yedek else ''})
            del DEFTER_GERI[:-10]
        print(f"[defter-kilidi] {k['alan']}: Codex'in değişikliği geri alındı ({os.path.relpath(yol, BEYIN)}; yedek {yedek or 'yok'})", flush=True)


sayfalar.yazildi = defter_kopyasi_tazele
KOPRU.tur_bitince = lambda thread: threading.Thread(target=defter_denetle, args=(thread,), daemon=True).start()


# Yazı arkadaşı (K-024): yazmayı bırakınca Codex notu okur, kenara en çok 3 öneri bırakır. İz bırakmayan, salt okunur tek tur.
ONERI_TALIMATI = '\n'.join([
    "Sen Beyin adlı ikinci beynin yazı arkadaşısın. Kullanıcı bir not yazıyor; sen yanında sessizce okuyor, gerekirse kenara kısa "
    "öneri bırakıyorsun. Kullanıcıyı (<kullanici>) ve geçmiş notlarını (<ilgili_notlar>) biliyorsun; Notion'dan farkın bu ve gerekince çizime dökmen.",
    "En çok 3 öneri; değer katmıyorsa hiç verme (boş liste). Türkçe, kısa, somut; em dash kullanma.",
    "Türler: degistir: alinti sayfadaki bir parça, yeni onun yerine geçecek metin (yazım hatası, netlik, yanlış bilgi, daha güçlü ifade); "
    "kullanıcının sesini koru, sesle yazdığı için yazım hatalarını anlamdan düzelt. ekle: yeni, alıntılanan bloğun hemen altına eklenecek "
    "kısa Markdown (alıntıyı tekrarlama). soru: yeni alanına alıntı üzerine düşündürecek, konuşmaya değer tek soru. ciz: alıntı görselle "
    "daha iyi anlaşılır; yeni alanına ne çizileceğini bir cümleyle yaz.",
    "alinti sayfada birebir geçmeli, tek bloktan ve tek satırdan olmalı, en çok 160 karakter. neden: bir cümle; <ilgili_notlar>'daki bir "
    "kayda dayanıyorsa kaynağını an. <gecmis_oneriler>'deki önerileri tekrarlama. Araç kullanma, dosya okuma: her şey mesajda.",
    "Ayrıca ogrenilen (en çok 2, çoğu zaman boş): notta kullanıcının işi, hedefi, kararı ya da kalıcı çalışma biçimi hakkında yeni ve "
    "kalıcı bir bilgi görürsen. iddia: tek kısa cümle, senin sözünle (örnek: 'Ekim hedefi: kliniklerde 12 görüşme'). alinti: dayandığı "
    "cümle, sayfadan birebir. hedef: bilgi (bu alana ait olgu, hedef, karar) ya da tercih (kullanıcının kalıcı çalışma biçimi). bolum: "
    "Bilgi sayfasında altına gireceği kısa başlık (örnek: Hedefler). Bunlar kullanıcıya 'bu bilgi bu mu?' diye sorulur; emin olmadığını, "
    "geçici olanı, <kullanici> ya da <ilgili_notlar>'da zaten olanı ve <sorulanlar>'dakileri koyma.",
])
ONERI_SEMA = {'type': 'object', 'additionalProperties': False, 'required': ['oneriler'], 'properties': {'oneriler': {
    'type': 'array', 'maxItems': 3, 'items': {'type': 'object', 'additionalProperties': False, 'required': ['tur', 'alinti', 'yeni', 'neden'],
    'properties': {'tur': {'type': 'string', 'enum': ['degistir', 'ekle', 'soru', 'ciz']}, 'alinti': {'type': 'string'},
                   'yeni': {'type': 'string'}, 'neden': {'type': 'string'}}}},
    'ogrenilen': {'type': 'array', 'maxItems': 2, 'items': {'type': 'object', 'additionalProperties': False,
                  'required': ['iddia', 'alinti', 'hedef', 'bolum'], 'properties': {'iddia': {'type': 'string'}, 'alinti': {'type': 'string'},
                  'hedef': {'type': 'string', 'enum': ['bilgi', 'tercih']}, 'bolum': {'type': 'string'}}}}}}
ONERI_SEMA['required'].append('ogrenilen')


def yazi_onerisi(istek):
    s = sayfalar.oku(BEYIN, istek['sayfa'])
    ca, _ = alan_bul(s['alan']) if s['alan'] else (None, None)
    izole = bool(ca and ca.get('izole'))
    haric, haric_proje = gizli_haric((ca or {}).get('id'))
    kendisi = os.path.relpath(sayfalar._yol(BEYIN, s['id']), BEYIN)
    ekler = [b for b in (hafiza.ben_baglami(BEYIN, True),
                         hafiza.notlar_baglami(BEYIN, (s['title'] + '\n' + s['govde'])[:1500], ca['id'] if izole else None, haric + (kendisi,), haric_proje)) if b]
    ekler.append(sayfa_bloku(s['id']))
    gecmis = [str(g)[:300] for g in (istek.get('gecmis') or [])][-30:]
    if gecmis:
        ekler.append('<gecmis_oneriler>\nBunları zaten önerdin, kullanıcı uyguladı ya da geçti; tekrarlama:\n' + '\n'.join('- ' + g for g in gecmis) + '\n</gecmis_oneriler>')
    sorulan = [k['iddia'] for k in dogrula_oku() if k['alan'] == s['alan']][-30:] if s['alan'] else []
    if sorulan:
        ekler.append('<sorulanlar>\nBunları zaten sordun (bekliyor, onaylandı ya da reddedildi); ogrenilen listesine koyma:\n' + '\n'.join('- ' + x for x in sorulan) + '\n</sorulanlar>')
    model = next((m['id'] for m in KOPRU.modeller() if 'luna' in m['id']), None)  # hızlı model: öneri birkaç saniyede gelsin
    cevap = KOPRU.tek_tur(ONERI_TALIMATI, ekler, 'Nota bak; değer katan öneri varsa ver, yoksa boş liste.', ONERI_SEMA, model, 'low')
    try:
        veri = json.loads(cevap)
    except ValueError:
        return []
    for o in (veri.get('ogrenilen') or []) if s['alan'] else []:
        dogrula_ekle(s['alan'], o.get('iddia'), o.get('hedef'), o.get('bolum'), 'Defter', o.get('alinti'))
    return veri.get('oneriler') or []


# Doğrulama kuyruğu (S-017, K-069): Codex'in çıkardığı bilgi kullanıcı "evet" diyene kadar tahmindir. Sorular üstteki Codex düğmesinde
# birikir, araya girmez; onaylanan alanın Bilgi sayfasına ya da hafızaya (tercih) yazılır, Defter'e asla. Reddedilen yeniden sorulmaz.
DOGRULA_DOSYASI = os.path.join(DURUM, 'dogrulama.json')
DOGRULA_BEKLEYEN = 6  # aynı anda biriken soru; dolunca yenisi alınmaz (S-002: Codex ne sıklıkta sorsun)
dogrula_kilit = threading.Lock()
_duz = lambda m: re.sub(r'[\W_]+', ' ', str(m).lower()).strip()


def dogrula_oku():
    try:
        with open(DOGRULA_DOSYASI, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


def dogrula_ekle(alan, iddia, hedef='bilgi', bolum='', kaynak='Codex', alinti=''):
    """Yeni soru. Aynı iddia (bekleyen, onaylanan, reddedilen) yeniden sorulmaz; kuyruk doluysa alınmaz."""
    iddia = re.sub(r'\s+', ' ', str(iddia or '')).strip()[:240]
    if not iddia or not alan_bul(alan)[1]:
        return None
    with dogrula_kilit:
        liste = dogrula_oku()
        if any(_duz(k['iddia']) == _duz(iddia) for k in liste) or sum(k['durum'] == 'bekliyor' for k in liste) >= DOGRULA_BEKLEYEN:
            return None
        kayit = {'no': uuid.uuid4().hex[:8], 'alan': alan, 'iddia': iddia, 'hedef': 'tercih' if hedef == 'tercih' else 'bilgi',
                 'bolum': re.sub(r'[#\n]+', ' ', str(bolum or '')).strip()[:40], 'kaynak': str(kaynak or 'Codex')[:20],
                 'alinti': str(alinti or '')[:160], 'zaman': int(time.time()), 'durum': 'bekliyor'}
        os.makedirs(DURUM, exist_ok=True)
        with open(DOGRULA_DOSYASI, 'w', encoding='utf-8') as f:
            json.dump((liste + [kayit])[-300:], f, ensure_ascii=False, indent=1)
    return kayit


def dogrula_bekleyen():
    """Üstteki Codex düğmesinin listesi: bekleyen sorular, alan adı ve nereye yazılacağıyla."""
    sonuc = []
    for k in dogrula_oku():
        ca, a = alan_bul(k['alan'])
        if k['durum'] == 'bekliyor' and a:
            sonuc.append({**k, 'alan_ad': a['ad'], 'calisma': ca['id'],
                          'nereye': 'Hafıza › Tercihler' if k['hedef'] == 'tercih' else 'Bilgi › ' + (k['bolum'] or 'Doğrulananlar')})
    return sonuc


def bilgiye_ekle(alan_id, bolum, iddia):
    """Onaylanan bilgiyi alanın Bilgi sayfasına, bölüm başlığının altına ekler; bölüm yoksa sona açar. Defter'e dokunmaz."""
    _, a = alan_bul(alan_id)
    s = sayfalar.bilgi_not(BEYIN, a['id'], a['ad'])
    govde, bas = s['govde'].rstrip(), '## ' + (bolum or 'Doğrulananlar')
    satir = f"- {iddia} (sen doğruladın, {date.today().isoformat()})"
    m = re.search('^' + re.escape(bas) + r'[ \t]*$', govde, re.M)
    if m:
        sonraki = re.search(r'^## ', govde[m.end():], re.M)
        kes = m.end() + sonraki.start() if sonraki else len(govde)
        govde = govde[:kes].rstrip() + '\n' + satir + '\n' + ('\n' + govde[kes:] if sonraki else '')
    else:
        govde = (govde + '\n\n' if govde else '') + bas + '\n' + satir + '\n'
    sayfalar.yaz(BEYIN, {'id': s['id'], 'govde': govde})
    return os.path.relpath(sayfalar._yol(BEYIN, s['id']), BEYIN)


def dogrula_karar(istek):
    """/api/dogrula: {no, karar: evet | hayir, iddia?: düzeltilmiş metin} ya da {karar: hepsi}. Evet: Bilgi'ye ya da tercihe yazar.
    Kilit çağıranda."""
    karar = istek.get('karar')
    if karar not in ('evet', 'hayir', 'hepsi'):
        raise ValueError('karar evet, hayir ya da hepsi olmalı')
    with dogrula_kilit:
        liste, yazilan = dogrula_oku(), []
        for k in liste:
            if k['durum'] != 'bekliyor' or (karar != 'hepsi' and k['no'] != istek.get('no')):
                continue
            if karar == 'hayir':
                k['durum'] = 'hayir'
                continue
            if not alan_bul(k['alan'])[1]:
                k['durum'] = 'hayir'  # alan kaldırılmış: yazılacak yer yok
                continue
            duzeltme = re.sub(r'\s+', ' ', str(istek.get('iddia') or '')).strip()[:240] if karar == 'evet' else ''
            if duzeltme:
                k['iddia'] = duzeltme
            k['yazildi'] = (os.path.join(hafiza.TERCIH, hafiza.tercih_ekle(BEYIN, k['iddia'])[len('tercih-'):] + '.md') if k['hedef'] == 'tercih'
                            else bilgiye_ekle(k['alan'], k['bolum'], k['iddia']))
            k['durum'] = 'evet'
            yazilan.append(k['yazildi'])
        with open(DOGRULA_DOSYASI, 'w', encoding='utf-8') as f:
            json.dump(liste, f, ensure_ascii=False, indent=1)
    return {'yazilan': yazilan, 'bekleyen': dogrula_bekleyen()}


# Defter'de Codex kutusu (K-033): seçilen parça ya da imlecin bölümü üzerinde tek seferlik iş; sonuç önizlenir, kullanıcı koyar
YAZI_EYLEM = {
    'toparla': ("Kullanıcının bu parçasını toparla. Sesle yazdığı için yazım hatalarını anlamdan düzelt; dağınık cümleleri kısa "
                "paragraf, madde ve gerekirse ### alt başlıklara düzenle; tekrarı birleştir. Bilgi ekleme, bilgi atma; kullanıcının sesini "
                "ve birinci tekil şahsı koru. Parça ## başlıkla başlıyorsa o başlığı aynen koru.", 'low'),
    'gecmis': ("Bu parçayı kullanıcının geçmişiyle değerlendir: <ilgili_notlar> ve <kullanici> içindeki kayıtlarla karşılaştır. Kısa "
               "Markdown maddeler, yalnız işe yarayanlar: **Yeni:** (geçmişte olmayan), **Daha önce:** (aynısını ya da benzerini nerede "
               "dedi), **Çelişen:** (önceki bir karar ya da tercihle çatışan), **Sorulacak:** (netleşmesi gereken). Her madde bir kayda "
               "dayanır ve sonunda kaynağı parantez içinde dosya yoluyla yazılır; kaynakları ayrıca kaynaklar listesine koy. Dayanak "
               "yoksa uydurma: \"Geçmişte buna dair kayıt yok.\" de. Çıkarımı kesin bilgi gibi sunma.", 'medium'),
    'serbest': ("Kullanıcının isteğini bu parçaya uygula ve sonucu Markdown olarak ver. Kullanıcının sesini koru; istemediği bilgiyi ekleme.", 'low'),
}
YAZI_SEMA = {'type': 'object', 'additionalProperties': False, 'required': ['metin', 'kaynaklar'], 'properties': {
    'metin': {'type': 'string'}, 'kaynaklar': {'type': 'array', 'maxItems': 8, 'items': {'type': 'string'}}}}


def yazi_kutusu(istek):
    """/api/codex/yazi: {sayfa, eylem, metin, istek?} → {metin, kaynaklar}. Bağlam yazı arkadaşıyla aynı (izolasyona uyar)."""
    talimat, efor = YAZI_EYLEM[istek['eylem']]
    parca = str(istek.get('metin') or '').strip()[:8000]
    if not parca:
        raise ValueError('parça boş')
    s = sayfalar.oku(BEYIN, istek['sayfa'])
    ca, _ = alan_bul(s['alan']) if s['alan'] else (None, None)
    izole = bool(ca and ca.get('izole'))
    haric, haric_proje = gizli_haric((ca or {}).get('id'))
    kendisi = os.path.relpath(sayfalar._yol(BEYIN, s['id']), BEYIN)
    ekler = [b for b in (hafiza.ben_baglami(BEYIN, True),
                         hafiza.notlar_baglami(BEYIN, parca[:1500], ca['id'] if izole else None, haric + (kendisi,), haric_proje)) if b]
    ekler.append(sayfa_bloku(s['id']))
    genel = ("Sen Beyin adlı ikinci beynin yazı arkadaşısın; kullanıcıyı (<kullanici>) ve geçmiş notlarını (<ilgili_notlar>) biliyorsun. "
             "Türkçe yaz, em dash ve en dash kullanma. Araç kullanma, dosya okuma: her şey mesajda. " + talimat)
    mesaj = f"<parca>\n{parca}\n</parca>" + (f"\n\nKullanıcının isteği: {str(istek.get('istek'))[:500]}" if istek.get('istek') else '')
    model = next((m['id'] for m in KOPRU.modeller() if 'luna' in m['id']), None)
    cevap = KOPRU.tek_tur(genel, ekler, mesaj, YAZI_SEMA, model, efor)
    try:
        d = json.loads(cevap)
        return {'metin': str(d.get('metin') or '').strip(), 'kaynaklar': [str(k) for k in d.get('kaynaklar') or []][:8]}
    except ValueError:
        raise RuntimeError('Codex cevabı okunamadı')


# Ortak beyin ağı ve doğrulama (K-035): Defter bölümleri, bilgi notları, gerçek bağlar; mekanik sağlık; elle Codex taraması
YOL_IZI = re.compile(r'(?:\.\./)*((?:notlar|sayfalar)/[\w-]+/[\w.-]+\.md|knowledge/[\w/-]+\.md|panolar/[\w.-]+\.dc\.html|ham/kaynaklar/[^)\s]+)')
NOT_KODU = re.compile(r'\b[KSIR]-\d{3}\b')


def _on_bilgi(metin):
    """Bilgi notu: '---' arası JSON ön bilgi, sonra gövde."""
    if metin.startswith('---\n'):
        bas, _, govde = metin[4:].partition('\n---')
        try:
            return json.loads(bas), govde
        except ValueError:  # tercih notları 'anahtar: değer' satırlarıyla yazılır
            return {k.strip(): v.strip() for k, _, v in (x.partition(':') for x in bas.splitlines()) if k.strip() and _}, govde
    return {}, metin


def ag_verisi():
    """Ağa giren yazı: her alanın Defter'i (## bölümleri, içindeki atıflar) ve bilgi notları (kaynak bağlarıyla). Gizli
    çalışma alanı ve onun projesindeki bilgi dışarıda."""
    c = calisma_oku()
    gizli_ca = {ca['id'] for ca in c['calisma_alanlari'] if ca.get('gizli')}
    defterler = []
    for ca in c['calisma_alanlari']:
        if ca.get('gizli'):
            continue
        for a in ca['alanlar']:
            for s_ in sayfalar.liste(BEYIN, a['id']):
                if not s_['ana']:
                    continue
                d = sayfalar.oku(BEYIN, s_['id'])
                govde = d['govde']
                defterler.append({'alan': a['id'], 'id': d['id'], 'yol': os.path.relpath(sayfalar._yol(BEYIN, d['id']), BEYIN),
                                  'bolumler': [x[3:].strip() for x in govde.splitlines() if x.startswith('## ')][:24],
                                  'kodlar': sorted(set(NOT_KODU.findall(govde))), 'yollar': sorted(set(YOL_IZI.findall(govde))),
                                  'dolu': len(re.sub(r'^>.*$', '', govde, flags=re.M).strip()) > 0, 'boy': len(govde)})
    bilgi = []
    for klasor in ('knowledge/concepts', 'knowledge/tercihler'):
        tam = os.path.join(BEYIN, klasor)
        for ad in sorted(os.listdir(tam)) if os.path.isdir(tam) else []:
            if not ad.endswith('.md'):
                continue
            with open(os.path.join(tam, ad), encoding='utf-8') as f:
                on, govde = _on_bilgi(f.read())
            if on.get('project') in gizli_ca or on.get('validity') == 'rejected':
                continue
            ilk = next((x.strip() for x in govde.splitlines() if x.strip() and not x.startswith(('---', '{', '}'))), '')
            baslik = next((x[2:].strip() for x in govde.splitlines() if x.startswith('# ')), '') or re.sub(r'[*_`#>]', '', ilk)[:70] or ad[:-3].replace('-', ' ')
            bilgi.append({'yol': f'{klasor}/{ad}', 'ad': baslik, 'tur': on.get('kind', ''), 'proje': on.get('project', ''),
                          'yollar': sorted(set(YOL_IZI.findall(govde)))})
    return {'defterler': defterler, 'bilgi': bilgi}


def saglik():
    """Mekanik doğrulama, modelsiz: hafıza eşitleme durumu, onay bekleyen varsayımlar, açık sorular, kopuk bağlar."""
    try:
        doktor = json.loads(subprocess.run([sys.executable, os.path.join(BEYIN, 'beyin.py'), 'doctor'], cwd=BEYIN, capture_output=True,
                                           text=True, timeout=20).stdout or '{}')
    except (subprocess.SubprocessError, ValueError, OSError):
        doktor = {}
    es = (doktor.get('hook-health.json') or {}).get('sync') or {}
    c = calisma_oku()
    gizli_alan = {a['id'] for ca in c['calisma_alanlari'] if ca.get('gizli') for a in ca['alanlar']}
    ns = [n for n in notlar() if n['alan'] not in gizli_alan]
    panolar = canvas_oku().get('boards', {})
    kopuk = [{'yer': f"notlar/{n['alan']}/{n['dosya']}", 'neye': n['pano']} for n in ns if n.get('pano') and n['pano'] not in panolar]
    for d in ag_verisi()['defterler']:
        kopuk += [{'yer': d['yol'], 'neye': y} for y in d['yollar'] if not os.path.exists(os.path.join(BEYIN, unquote(y)))]
    kayit = lambda n: {'alan': n['alan'], 'no': n.get('no', ''), 'baslik': n.get('baslik', ''), 'yol': f"notlar/{n['alan']}/{n['dosya']}"}
    return {'kayit': es.get('indexed', 0), 'uyari': len(es.get('warnings') or []), 'cakisma': len(es.get('conflicts') or []),
            'sir': es.get('secrets_redacted', 0), 'esitleme': es.get('status', 'bilinmiyor'),
            'varsayimlar': [kayit(n) for n in ns if n.get('veren') in ('claude-varsayim', 'codex') and n.get('durum') == 'verildi'],
            'sorular': [kayit(n) for n in ns if n.get('durum') == 'acik'], 'kopuk': kopuk[:40], 'tarama': tarama_oku()}


def not_onay(istek):
    """Claude ya da Codex varsayımını kullanıcı onaylar: notun ön bilgisine 'onay: <tarih>' eklenir; veren değişmez (K-035)."""
    m = re.fullmatch(r'notlar/([\w-]+)/([\w.-]+\.md)', istek['yol'])
    if not m:
        raise ValueError('not yolu geçersiz')
    yol = os.path.join(NOTLAR, m.group(1), m.group(2))
    with open(yol, encoding='utf-8') as f:
        metin = f.read()
    if not metin.startswith('---\n') or re.search(r'^onay:', metin.split('\n---', 1)[0], re.M):
        return True
    bas, ayrac, govde = metin[4:].partition('\n---')
    satirlar = bas.split('\n')
    i = next((k for k, x in enumerate(satirlar) if x.startswith('veren:')), len(satirlar) - 1)
    satirlar.insert(i + 1, 'onay: ' + date.today().isoformat())
    with open(yol, 'w', encoding='utf-8') as f:
        f.write('---\n' + '\n'.join(satirlar) + ayrac + govde)
    return True


TARAMA = os.path.join(DURUM, 'tarama.json')
tarama_durum = {'calisiyor': False, 'ilerleme': '', 'hata': ''}
TARAMA_TALIMATI = ("Sen Beyin adlı ikinci beynin denetçisisin. Bu alanın Defter'ini ve kararlarını (<parca>) kullanıcının geri kalan "
                   "notlarıyla (<ilgili_notlar>, <kullanici>) karşılaştır. Yalnız dayanağı olan bulguları yaz: celisen (buradaki bir ifade "
                   "başka bir kayıtla çelişiyor), eskiyen (bir karar sonradan değişmiş ama burada eski hali duruyor), varsayim (Claude ya da "
                   "Codex'in kullanıcıca onaylanmamış önemli bir çıkarımı). Her bulgu: tur, ne (bir cümle, Türkçe, em dash yok), burada (bu "
                   "alandaki dosya yolu), kaynak (karşı kaydın dosya yolu ya da boş). Dayanak yoksa boş liste. Araç kullanma.")
TARAMA_SEMA = {'type': 'object', 'additionalProperties': False, 'required': ['bulgular'], 'properties': {'bulgular': {
    'type': 'array', 'maxItems': 6, 'items': {'type': 'object', 'additionalProperties': False, 'required': ['tur', 'ne', 'burada', 'kaynak'],
    'properties': {'tur': {'type': 'string', 'enum': ['celisen', 'eskiyen', 'varsayim']}, 'ne': {'type': 'string'},
                   'burada': {'type': 'string'}, 'kaynak': {'type': 'string'}}}}}}


def tarama_oku():
    try:
        with open(TARAMA, encoding='utf-8') as f:
            son = json.load(f)
    except (OSError, ValueError):
        son = {'zaman': '', 'bulgular': [], 'alanlar': []}
    return {**son, **tarama_durum}


def tarama_baslat(_istek):
    """Elle başlatılan Codex taraması: içi dolu her alan için bir tek tur (arka planda); sonuç .durum/tarama.json."""
    if tarama_durum['calisiyor']:
        raise ValueError('tarama zaten sürüyor')
    tarama_durum.update(calisiyor=True, ilerleme='başlıyor', hata='')
    threading.Thread(target=_tara, daemon=True).start()
    return True


def _tara():
    bulgular, taranan = [], []
    try:
        c = calisma_oku()
        defterler = {d['alan']: d for d in ag_verisi()['defterler']}
        ns = notlar()
        hedefler = [(ca, a) for ca in c['calisma_alanlari'] if not ca.get('gizli') for a in ca['alanlar']
                    if defterler.get(a['id'], {}).get('dolu') or any(n['alan'] == a['id'] for n in ns)]
        model = next((m['id'] for m in KOPRU.modeller() if 'luna' in m['id']), None)
        for i, (ca, a) in enumerate(hedefler, 1):
            tarama_durum['ilerleme'] = f"{i}/{len(hedefler)} · {a['ad']}"
            parca = []
            if a['id'] in defterler:
                d = sayfalar.oku(BEYIN, defterler[a['id']]['id'])
                parca.append(f"### Defter ({defterler[a['id']]['yol']})\n{d['govde'][:5000]}")
            for n in [n for n in ns if n['alan'] == a['id'] and n.get('durum') != 'vazgecildi'][-12:]:
                parca.append(f"### notlar/{a['id']}/{n['dosya']} · {n.get('veren', '')} · {n.get('baslik', '')}\n{n.get('govde', '')[:600]}")
            metin = '\n\n'.join(parca)
            izole = bool(ca.get('izole'))
            haric, haric_proje = gizli_haric(ca['id'])
            ekler = [b for b in (hafiza.ben_baglami(BEYIN, True),
                                 hafiza.notlar_baglami(BEYIN, metin[:1500], ca['id'] if izole else None, haric + (f"notlar/{a['id']}/",), haric_proje)) if b]
            cevap = KOPRU.tek_tur(TARAMA_TALIMATI, ekler, f'<parca>\n{metin}\n</parca>', TARAMA_SEMA, model, 'medium')
            for b in (json.loads(cevap).get('bulgular') or []):
                bulgular.append({**b, 'alan': a['id'], 'calisma': ca['id']})
            taranan.append(a['id'])
        with open(TARAMA, 'w', encoding='utf-8') as f:
            json.dump({'zaman': zaman.strftime('%Y-%m-%dT%H:%M:%S'), 'bulgular': bulgular, 'alanlar': taranan}, f, ensure_ascii=False, indent=1)
        tarama_durum.update(ilerleme='')
    except Exception as e:  # tarama yardımcıdır: hata ekranda görünür, kayda düşer
        tarama_durum.update(hata=str(e)[:200])
        hata_yaz({'kaynak': 'tarama', 'mesaj': str(e)[:500]})
    finally:
        tarama_durum['calisiyor'] = False


# Kaynaklar ve video süreci (K-038, K-067): YouTube linki sıraya girer; Beyin'in kendi süreci yt-dlp ile indirir (altyazı varsa
# onu alır, yoksa mlx_whisper yerelde dinler), ffmpeg ile 16 kare çıkarır; transkript kaynak klasörüne yazılır; Codex tek turu
# özetler ve alanın Bilgi sayfasına '## Videolar' altına koyar. Bir seferde bir video. Araçlar Beyin'in kendi klasöründe
# (.arac/video, `sh araclar/video-kur.sh`); kurulmadıysa geçiş için eski global klasörün yt-dlp ve mlx_whisper'ı kullanılır.
YOUTUBE = re.compile(r'https?://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?v=|shorts/|live/)|youtu\.be/)([\w-]{11})')
VIDEO_ARAC_BEYIN = os.path.join(BEYIN, '.arac', 'video', 'bin')
VIDEO_ARAC_ESKI = os.path.expanduser('~/.claude/skills/watch-youtube/.venv/bin')
VIDEO_KAYIT = os.path.join(DURUM, 'videolar.json')
video_kilit = threading.Lock()


def video_araci():
    """yt-dlp ve mlx_whisper'ın klasörü: ortam değişkeni, Beyin'in kendi .arac/video'su, yoksa eski global klasör."""
    for k in (os.environ.get('BEYIN_VIDEO_ARAC', ''), VIDEO_ARAC_BEYIN, VIDEO_ARAC_ESKI):
        if k and os.path.exists(os.path.join(k, 'yt-dlp')):
            return k
    return VIDEO_ARAC_BEYIN


def videolar_oku():
    try:
        with open(VIDEO_KAYIT, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


def videolar_yaz(liste):
    os.makedirs(DURUM, exist_ok=True)
    with open(VIDEO_KAYIT, 'w', encoding='utf-8') as f:
        json.dump(liste[-200:], f, ensure_ascii=False, indent=1)


def video_guncelle(no, **alanlar):
    with video_kilit:
        liste = videolar_oku()
        for v in liste:
            if v['no'] == no:
                v.update(alanlar)
        videolar_yaz(liste)


VIDEO_UZANTI = ('.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi')


def video_ekle(istek):
    """/api/video: {alan, url} YouTube ya da {alan, dosya} bilgisayardan eklenen video (ham/ altında yol).
    Aynı video aynı alanda bitmiş ya da sürüyorsa yeniden eklenmez."""
    if istek.get('dosya'):
        return _yerel_video_ekle(istek)
    m = YOUTUBE.search(str(istek.get('url') or ''))
    if not m:
        raise ValueError('YouTube linki değil')
    ca, a = alan_bul(istek['alan'])
    if not a:
        raise ValueError('alan yok')
    with video_kilit:
        liste = videolar_oku()
        eski = next((v for v in liste if v['vid'] == m.group(1) and v['alan'] == a['id'] and v['asama'] != 'hata'), None)
        if eski:
            return eski['no']
        no = zaman.strftime('%Y%m%d%H%M%S') + '-' + m.group(1)
        liste.append({'no': no, 'vid': m.group(1), 'url': f'https://www.youtube.com/watch?v={m.group(1)}', 'alan': a['id'], 'calisma': ca['id'],
                      'baslik': '', 'sure': 0, 'asama': 'sirada', 'hata': '', 'zaman': zaman.strftime('%Y-%m-%dT%H:%M:%S')})
        videolar_yaz(liste)
    _video_isci()
    return no


def _yerel_video_ekle(istek):
    """Yerel video (K-045): dosya zaten ham/kaynaklar altında; kimliği yolundan, adresi /ham/... üzerinden."""
    gor = os.path.normpath(str(istek['dosya'])).lstrip('/')
    yol = os.path.join(BEYIN, gor)
    if not gor.startswith('ham' + os.sep) or not os.path.isfile(yol) or not gor.lower().endswith(VIDEO_UZANTI):
        raise ValueError('video dosyası bulunamadı')
    ca, a = alan_bul(istek['alan'])
    if not a:
        raise ValueError('alan yok')
    vid = 'y' + hashlib.md5(gor.encode()).hexdigest()[:10]
    with video_kilit:
        liste = videolar_oku()
        eski = next((v for v in liste if v['vid'] == vid and v['alan'] == a['id'] and v['asama'] != 'hata'), None)
        if eski:
            return eski['no']
        no = zaman.strftime('%Y%m%d%H%M%S') + '-' + vid
        ad = re.sub(r'^\d{8}-\d{6}-', '', os.path.splitext(os.path.basename(gor))[0])
        liste.append({'no': no, 'vid': vid, 'url': '/' + gor.replace(os.sep, '/'), 'yerel': gor, 'alan': a['id'], 'calisma': ca['id'],
                      'baslik': ad.replace('-', ' ')[:200], 'sure': 0, 'asama': 'sirada', 'hata': '', 'zaman': zaman.strftime('%Y-%m-%dT%H:%M:%S')})
        videolar_yaz(liste)
    _video_isci()
    return no


def _video_isci():
    if getattr(_video_isci, 'calisiyor', False):
        return
    _video_isci.calisiyor = True
    threading.Thread(target=_video_dongu, daemon=True).start()


def _video_dongu():
    try:
        while True:
            sira = next((v for v in videolar_oku() if v['asama'] == 'sirada'), None)
            if not sira:
                return
            try:
                _video_isle(sira)
            except Exception as e:  # bir videonun hatası kuyruğu durdurmaz; kart hata gösterir, kayda düşer
                video_guncelle(sira['no'], asama='hata', hata=str(e)[:200])
                hata_yaz({'kaynak': 'video', 'mesaj': f"{sira['url']}: {e}"[:500]})
    finally:
        _video_isci.calisiyor = False


def _vtt_metin(yol):
    """VTT altyazıdan zaman damgalı düz metin; tekrarlayan satırlar atılır."""
    satirlar, son, an = [], '', ''
    with open(yol, encoding='utf-8', errors='replace') as f:
        for x in f:
            x = x.strip()
            if '-->' in x:
                an = x.split('.')[0][-8:].lstrip('0:') or '0'
                continue
            x = re.sub(r'<[^>]+>', '', x)
            if not x or x.startswith(('WEBVTT', 'Kind:', 'Language:')) or x == son:
                continue
            satirlar.append(f'[{an}] {x}')
            son = x
    return '\n'.join(satirlar)


def _video_isle_yerel(v, kaynak=None, altyazi=None):
    """Video dosyasından kaynak: ffprobe süre, transkript (hazır altyazı yoksa mlx_whisper VTT), ffmpeg ile eşit aralıklı 16
    kare, Codex özeti. Yerel video doğrudan; YouTube indirildikten sonra buradan geçer (kaynak ve altyazı geçici klasörde)."""
    kaynak = kaynak or os.path.join(BEYIN, v['yerel'])
    tmp = os.path.join(DURUM, 'video-tmp', v['no'])
    os.makedirs(tmp, exist_ok=True)
    ortam = {**os.environ, 'XDG_CACHE_HOME': os.path.join(BEYIN, '.durum', 'cache')}
    sure = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', kaynak],
                          capture_output=True, text=True, timeout=60).stdout.strip()
    v['sure'] = int(float(sure)) if re.fullmatch(r'[\d.]+', sure or '') else v.get('sure', 0)
    video_guncelle(v['no'], sure=v['sure'], asama='dinleniyor')
    metin = _vtt_metin(altyazi) if altyazi and os.path.exists(altyazi) else ''
    if not metin:
        subprocess.run([os.path.join(video_araci(), 'mlx_whisper'), kaynak, '--output-format', 'vtt', '--output-dir', tmp, '--output-name', 'ses'],
                       capture_output=True, text=True, timeout=3600, env=ortam)
        vtt = os.path.join(tmp, 'ses.vtt')
        metin = _vtt_metin(vtt) if os.path.exists(vtt) else ''
    video_guncelle(v['no'], asama='kareler')
    klasor = os.path.join(KAYNAK, v['calisma'], v['alan'], 'video', v['vid'])
    os.makedirs(klasor, exist_ok=True)
    aralik = max(1.0, v['sure'] / 16) if v['sure'] else 10.0
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', kaynak, '-vf', f'fps=1/{aralik:.2f},scale=480:-2', '-frames:v', '16',
                    os.path.join(klasor, 'kare-%02d.jpg')], capture_output=True, timeout=900)
    if metin:
        with open(os.path.join(klasor, 'transkript.txt'), 'w', encoding='utf-8') as f:
            f.write(f"{v['baslik']}\n{v['url']}\n\n{metin}\n")
    shutil.rmtree(tmp, ignore_errors=True)
    video_guncelle(v['no'], asama='ozetleniyor', kareler=len([f for f in os.listdir(klasor) if f.endswith('.jpg')]))
    _video_ozetle(v, v['baslik'], metin)
    video_guncelle(v['no'], asama='bitti')


def _video_isle(v):
    if v.get('yerel'):
        return _video_isle_yerel(v)
    arac, tmp = video_araci(), os.path.join(DURUM, 'video-tmp', v['no'])
    os.makedirs(tmp, exist_ok=True)
    ortam = {**os.environ, 'TMPDIR': tmp, 'XDG_CACHE_HOME': os.path.join(BEYIN, '.durum', 'cache')}
    js = [a for ad in ('node', 'deno', 'bun') if (y := shutil.which(ad)) for a in ('--js-runtimes', f'{ad}:{y}')][:2]  # YouTube imzası için
    video_guncelle(v['no'], asama='indiriliyor')
    bilgi = subprocess.run([os.path.join(arac, 'yt-dlp'), *js, '--skip-download', '--print', '%(title)s\t%(duration)s\t%(language)s', v['url']],
                           capture_output=True, text=True, timeout=90, env=ortam)
    baslik, sure, dil = ((bilgi.stdout.strip().splitlines() or [''])[0].split('\t') + ['', ''])[:3]
    dil = dil if re.fullmatch(r'[a-z]{2,3}(-[A-Za-z]+)?', dil or '') else ''
    v.update(baslik=baslik[:200], sure=int(float(sure)) if sure.replace('.', '').isdigit() else 0)
    video_guncelle(v['no'], baslik=v['baslik'], sure=v['sure'])
    # Altyazı ayrı ve hatası önemsiz (yoksa ya da YouTube sınırlarsa whisper dinler); yalnız tam adlı birkaç dil: videonun dili,
    # tr, en ve onların özgün otomatik altyazısı (-orig). Joker dil onlarca çeviri ister, YouTube 429 verir.
    temel = [d for d in dict.fromkeys((dil.split('-')[0] if dil else '', 'tr', 'en')) if d]
    subprocess.run([os.path.join(arac, 'yt-dlp'), *js, '--skip-download', '--write-subs', '--write-auto-subs', '--sub-format', 'vtt', '--no-playlist',
                    '--sub-langs', ','.join(x for d in temel for x in (d, d + '-orig')), '-o', os.path.join(tmp, 'video.%(ext)s'), v['url']],
                   capture_output=True, text=True, timeout=120, env=ortam)
    # Kareler için 720p'yi geçmeyen mp4 (avc1 en az 403 verir)
    indir = subprocess.run([os.path.join(arac, 'yt-dlp'), *js, '-f', 'bestvideo[height<=720][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/136+140/18/best[ext=mp4]/best',
                            '--merge-output-format', 'mp4', '--no-playlist', '-o', os.path.join(tmp, 'video.%(ext)s'), v['url']],
                           capture_output=True, text=True, timeout=1800, env=ortam)
    dosya = next((os.path.join(tmp, f) for f in sorted(os.listdir(tmp)) if f.startswith('video.') and f.endswith(('.mp4', '.mkv', '.webm'))), None)
    if indir.returncode != 0 or not dosya:
        raise RuntimeError('video indirilemedi: ' + ' '.join((indir.stderr or indir.stdout).strip().splitlines()[-2:])[:160])
    _video_isle_yerel(v, dosya, altyazi_sec(tmp, dil))


def altyazi_sec(klasor, dil):
    """İndirilen altyazılardan biri: videonun dili, sonra özgün otomatik (-orig), sonra tr, en; yoksa None (whisper dinler)."""
    dil_ = lambda f: f.split('.')[-2]
    sira = lambda f: (not (dil and dil_(f).split('-')[0] == dil.split('-')[0]), not dil_(f).endswith('-orig'), dil_(f).split('-')[0] != 'tr', f)
    vttler = sorted((f for f in os.listdir(klasor) if f.endswith('.vtt')), key=sira)
    return os.path.join(klasor, vttler[0]) if vttler else None


VIDEO_TALIMATI = ("Sen Beyin adlı ikinci beynin video özetçisisin. Transkripti (<transkript>) oku, kullanıcıyı (<kullanici>) ve alanın geçmiş "
                  "notlarını (<ilgili_notlar>) bil. Türkçe, kısa, somut Markdown yaz; em dash kullanma. Biçim: önce tek cümle ana fikir, sonra "
                  "'- [mm:ss] ...' biçiminde 4 ile 8 ana nokta (zaman damgası transkriptten), sonra 'Bu alan için:' ile başlayan bir iki madde "
                  "(alanın notlarıyla bağ ya da çelişki; dayanak yoksa yazma). Transkript yoksa yalnız 'Transkript alınamadı.' yaz. Araç kullanma.")
VIDEO_SEMA = {'type': 'object', 'additionalProperties': False, 'required': ['ozet'], 'properties': {'ozet': {'type': 'string'}}}


def _video_ozetle(v, baslik, metin):
    ca, a = alan_bul(v['alan'])
    if not a:
        return
    izole = bool(ca and ca.get('izole'))
    haric, haric_proje = gizli_haric(ca['id'])
    ekler = [b for b in (hafiza.ben_baglami(BEYIN, True), hafiza.notlar_baglami(BEYIN, (baslik + ' ' + metin)[:1500], ca['id'] if izole else None, haric, haric_proje)) if b]
    model = next((m['id'] for m in KOPRU.modeller() if 'luna' in m['id']), None)
    ozet = json.loads(KOPRU.tek_tur(VIDEO_TALIMATI, ekler, f'<transkript>\n{baslik}\n{metin[:14000]}\n</transkript>', VIDEO_SEMA, model, 'low', 180)).get('ozet', '').strip()
    sn = v.get('sure', 0)
    sure = (f' · {sn} sn' if sn < 60 else f' · {round(sn / 60)} dk') if sn else ''
    klasor = f"ham/kaynaklar/{v['calisma']}/{v['alan']}/video/{v['vid']}"
    kareler = sorted(f for f in os.listdir(os.path.join(BEYIN, klasor)) if f.endswith('.jpg')) if os.path.isdir(os.path.join(BEYIN, klasor)) else []
    bolum = f"### {baslik or v['vid']}{sure}\n\n[Videoyu aç]({v['url']})" + (f" · [Kareler](/{klasor}/{kareler[0]})" if kareler else '') + f"\n\n{ozet}"
    b = sayfalar.bilgi_not(BEYIN, a['id'], a['ad'])
    govde = b['govde']
    eski = re.search(r'^### ' + re.escape(baslik or v['vid']) + r'.*?(?=^#{2,3} |\Z)', govde, re.M | re.S)
    if eski:
        govde = govde[:eski.start()] + bolum + '\n\n' + govde[eski.end():]
    elif '## Videolar' in govde:
        i = govde.index('## Videolar') + len('## Videolar')
        govde = govde[:i] + '\n\n' + bolum + govde[i:]
    else:
        govde = (govde.rstrip() + '\n\n## Videolar\n\n' + bolum).strip()
    sayfalar.yaz(BEYIN, {'id': b['id'], 'govde': govde.strip() + '\n'})
    video_guncelle(v['no'], ozet=ozet[:6000])  # video görünümü bölümleri buradan okur


ZAMANLI = re.compile(r'\[(\d{1,2}(?::\d{2}){1,2})\]\s*(.+)')


def _saniye(t):
    p = [int(x) for x in t.split(':')]
    return sum(x * 60 ** i for i, x in enumerate(reversed(p)))


def video_detay(no):
    """/api/video-detay?no=: Video görünümü A (K-045). Kareler (zamanı sıradan), transkript, Codex özetinin zamanlı maddeleri.
    Eski videolarda özet kayıtta yoksa Bilgi'deki bölümden okunur."""
    v = next((x for x in videolar_oku() if x['no'] == no), None)
    if not v:
        raise StopIteration
    klasor = os.path.join(KAYNAK, v['calisma'], v['alan'], 'video', v['vid'])
    kareler = sorted(f for f in os.listdir(klasor) if f.endswith('.jpg')) if os.path.isdir(klasor) else []
    sure = v.get('sure') or 0
    tr = []
    yol = os.path.join(klasor, 'transkript.txt')
    if os.path.exists(yol):
        with open(yol, encoding='utf-8') as f:
            tr = [{'t': _saniye(m.group(1)), 'metin': m.group(2)} for m in map(ZAMANLI.match, f) if m]
    ozet = v.get('ozet') or ''
    if not ozet:
        ca, a = alan_bul(v['alan'])
        govde = sayfalar.bilgi_not(BEYIN, a['id'], a['ad'])['govde'] if a else ''
        m = re.search(r'^### ' + re.escape(v.get('baslik') or v['vid']) + r'.*?(?=^#{2,3} |\Z)', govde, re.M | re.S)
        ozet = m.group(0) if m else ''
    maddeler = [{'t': _saniye(m.group(1)), 'metin': m.group(2).strip()} for m in (ZAMANLI.search(x) for x in ozet.splitlines() if x.lstrip().startswith('-')) if m]
    ana = next((x.strip() for x in ozet.splitlines() if x.strip() and not x.lstrip().startswith(('-', '#', '['))), '')
    return {**v, 'ozet': ozet, 'ana': ana, 'maddeler': maddeler, 'transkript': tr[:600],
            'kareler': [{'url': '/' + os.path.relpath(os.path.join(klasor, k), BEYIN), 't': round(i * sure / max(1, len(kareler)))} for i, k in enumerate(kareler)]}


def kaynaklar(alan):
    """/api/kaynaklar: alanın dosya ve linkleri (video iç dosyaları hariç) ve video işleri."""
    ca, a = alan_bul(alan)
    if not a:
        raise ValueError('alan yok')
    dosyalar = [d for d in veriler(ca['id'], a['id']) if '/video/' not in d['yol']]
    return {'dosyalar': dosyalar[:60], 'videolar': [v for v in videolar_oku() if v['alan'] == a['id']][::-1]}


# Tuvaldeki hızlı eylemler (K-038 adım 3). Eski panolar silinmez: revize aynı panoyu günceller, önceki sürüm
# .durum/pano-surum/ altında kalır; öbürleri yeni panoyu kabuğun bulduğu boş yere koyar.
def pano_yerlestir(istek):
    """Codex'in panosunu tuvale koyar (S-017): Codex canvas.json'u okumaz, düzenlemez; her çizimde 24 KB okumak turu uzatıyordu.
    Var olan panonun yeri korunur (başlık ve boy güncellenir). x, y yoksa sayfanın panolarının sağına, üst hizaya. Kilit çağıranda."""
    ad = istek['ad']
    if not (AD.match(ad) and ad.endswith('.dc.html') and os.path.exists(os.path.join(PROJE, ad))):
        raise ValueError('pano dosyası yok: ' + str(ad))
    c = canvas_oku()
    sayfa = istek.get('sayfa')
    if not any(p['id'] == sayfa for p in c.get('pages', [])):
        raise ValueError('tuval sayfası yok: ' + str(sayfa))
    sayi = lambda k, v: float(istek[k]) if isinstance(istek.get(k), (int, float)) else v
    boards = c.setdefault('boards', {})
    b = boards.get(ad)
    if b:
        b.update({k: v for k, v in (('title', istek.get('baslik')), ('w', sayi('w', None)), ('h', sayi('h', None))) if v})
    else:
        ayni = [x for x in boards.values() if x.get('page') == sayfa]
        b = boards[ad] = {'h': sayi('h', 900), 'is_interactive': False, 'page': sayfa, 'title': str(istek.get('baslik') or ad[:-8]),
                          'w': sayi('w', 1440), 'x': sayi('x', max((x['x'] + x.get('w', 1440) for x in ayni), default=-120) + 120),
                          'y': sayi('y', min((x['y'] for x in ayni), default=0))}
        c.setdefault('order', []).append(ad)
    canvas_yaz(c)
    return {'ad': ad, 'x': b['x'], 'y': b['y']}


def tema_ozeti():
    """tema.css'teki renk adları tek satırda: Codex dosyayı yeniden okumasın (her okuma bir adım, K-077)."""
    try:
        with open(os.path.join(PROJE, 'tema.css'), encoding='utf-8') as f:
            kok = re.search(r':root\{(.*?)\}', f.read(), re.S)
        return ', '.join(dict.fromkeys(re.findall(r'(--[a-z0-9-]+):', kok.group(1)))) if kok else ''
    except OSError:
        return ''


TARIF_SURUMU = 'k078'


def yerlestir_tarifi(sayfa, x=None, y=None):
    """Codex'e giden çizim tarifi (K-077): pano dosyaya yazılmaz, cevabın içinde <pano-yaz> bloğuyla verilir; Beyin bloğu
    akarken tuvale çizer, kapanınca dosyayı yazar ve tuvale koyar. x, y: yeni panonun yeri (hızlı eylem, bölge)."""
    konum = f' x="{round(x)}" y="{round(y)}"' if x is not None and y is not None else ''
    return ("Panoyu şöyle çiz: dosyaya kendin yazma, canvas.json'u okuma. Panoyu cevabının içinde aşağıdaki blokla ver; Beyin bloğu "
            "akarken tuvale çizer (kullanıcı yazılırken izler), blok kapanınca dosyayı yazar ve tuvale koyar:\n"
            f'<pano-yaz ad="<Ad>.dc.html" baslik="<başlık>" w="1440" h="900"{konum}>\n'
            '<div class="pk">…işaretleme…</div>\n'
            "</pano-yaz>\n"
            "Bloğun içi yalnız kök <div class=\"pk\">; w ve h panonun boyu (içerik uzarsa Beyin boyu büyütür, denetim için tur harcama). "
            "<!doctype>, <html>, <x-dc>, <script> yazma, kod çiti (```) kullanma; iskeleti ve stil bağlarını Beyin ekler. "
            "Stil yazma: pano kiti (K-078) hazır, yalnız şu sınıfları kullan. Başlık: .pk-bas (satır: solda başlık, sağda .pk-yan notu), "
            ".pk-ust (küçük üst etiket), h1, .pk-ozet. Düzen: .pk-izgara (3 sütun; .s2 .s4 .s5), .pk-satir, .pk-cizgi. Kutu: .pk-kart "
            "(içinde .pk-etiket, h2 küçük başlık, h3 büyük başlık, p, liste; .vurgu çerçeve), .pk-bant (renkli sonuç şeridi; strong ve p), "
            ".pk-koyu (koyu şerit). Öğe: .pk-etiket (hap), ul.pk-liste, ul.pk-tik (onay), .pk-akis (oklu adımlar; her adım <div><i>01</i>"
            "<b>Ad</b><small>açıklama</small></div>), .pk-sayi (<b>sayı</b><small>etiket</small>), .pk-not, table.pk-tablo. Renk sınıfı "
            "(kart, etiket, bant, adım, sayıya): mavi yesil sari kirmizi mor turuncu gri pembe. Kitin karşılamadığı nadir bir şey için "
            "kısa satır içi stil yaz, renk yalnız var(--…): " + tema_ozeti() + ". "
            "Yukarıdan aşağı yaz: önce başlık ve ana yapı, sonra ayrıntı; kullanıcı yapıyı erken görsün. "
            "Bloğu ilk iş olarak yaz: PANO.md ve tema.css'i yeniden okuma, gereken kaynağı en az okumayla al; not, hafıza ve receipt "
            "işlerini panodan sonra yap. Bloktan sonra tek cümleyle neyi çizdiğini söyle. "
            f"Tuval sayfası '{sayfa}'. Var olan panonun çoğu değişiyorsa aynı ad'la yeni blok ver (yeri korunur; x ve y yalnız yeni panoda); "
            "bir iki satırlık düzeltmede dosyayı (panolar/<Ad>.dc.html) yerinde düzelt. Etkileşimli pano (durum, tıklama, dc-import) gerekiyorsa "
            "eski yol: dosyayı PANO.md biçiminde panolar/ altına yaz, sonra "
            f"`curl -s -X POST http://127.0.0.1:{PORT}/api/pano-yerlestir -H 'Content-Type: application/json' "
            f"-d '{{\"ad\":\"<Ad>.dc.html\",\"sayfa\":\"{sayfa}\",\"baslik\":\"<başlık>\",\"w\":1440,\"h\":900}}'`.")


# Canlı çizim (K-077): Codex'in cevabı akarken <pano-yaz ad= baslik= w= h=>…</pano-yaz> bloğu yakalanır. Blok açılınca pano
# tuvale konur (yeni panoda boş yer tutucu dosyayla), içerik parça parça yayınlanır (beyin/pano-akis: tuval panoyu yazıldıkça
# gösterir), blok kapanınca dosya yazılır. Codex'in okuyucu thread'i bekletilmez: bildirimler kuyruğa girer, tek işçi sırayla
# işler ve kilidi orada alır (okuyucuyu kilitte bekletmek, kilidi tutup Codex cevabı bekleyen istekle kilitlenmek demekti).
PANO_AC = re.compile(r'<pano-yaz\b([^>]*)>\n?')
PANO_KAPA = '</pano-yaz>'
PANO_BAGLAM = {}   # alan -> son gönderimin tuval bağlamı: {'sayfa', 'yer': {'x', 'y'} | None}
PANO_AKIS = {}     # süren akışlar, ad -> {'icerik', 'baslik', 'w', 'h', 'x', 'y', 'thread'}; sonradan açılan tuval buradan tamamlar
_pano_durum = {}   # itemId -> {'thread', 'metin', 'imlec', 'acik'}
_pano_kuyruk = queue.Queue()
_pano_isci = []


def pano_sar(icerik, baslik, w, h):
    """Bloktaki gövdeyi (helmet ve kök div) pano dosyasına sarar; tam belge geldiyse olduğu gibi kalır."""
    icerik = re.sub(r'\n```\s*$', '', re.sub(r'^\s*```[a-z]*\n', '', icerik)).strip()
    if re.match(r'<!doctype', icerik, re.I):
        return icerik + '\n'
    # tema.css (renkler) ve pano-kit.css (ortak sınıflar, K-078): Codex yazmadıysa eklenir
    bag = ''.join(f'<link rel="stylesheet" href="./{d}">' for d in ('tema.css', 'pano-kit.css') if d not in icerik)
    if bag:
        icerik = icerik.replace('<helmet>', '<helmet>' + bag, 1) if '<helmet>' in icerik else f'<helmet>{bag}</helmet>\n' + icerik
    return ('<!doctype html>\n<html lang="tr"><head><meta charset="utf-8"><title>' + html.escape(baslik) + '</title><script src="./support.js"></script></head><body><x-dc>\n'
            + icerik + '\n</x-dc><script type="text/x-dc" data-dc-script data-props=\'{"$preview":{"width":%d,"height":%d}}\'>'
            'class Component extends DCLogic { renderVals(){ return {}; } }</script></body></html>\n' % (round(w), round(h)))


def _pano_dosya_yaz(ad, metin):
    yol = os.path.join(PROJE, ad)
    with open(yol + '.yaziliyor', 'w', encoding='utf-8') as f:
        f.write(metin)
    os.replace(yol + '.yaziliyor', yol)


def _pano_yayinla(**p):
    KOPRU._olay({'method': 'beyin/pano-akis', 'params': p})


def _pano_baslat(thread, oz):
    """Blok açıldı: panoyu tuvale koyar ve akışı duyurur. Geçersiz ad ya da Beyin'den gönderilmemiş tur: None (blok atlanır)."""
    alan = next((a for a, g in KOPRU.gorevler.items() if g.get('thread') == thread), None)
    bag, ad = PANO_BAGLAM.get(alan), oz.get('ad', '')
    if not bag or not bag.get('sayfa') or not (AD.match(ad) and ad.endswith('.dc.html')):
        return None
    sayi = lambda k, v: float(oz[k]) if re.fullmatch(r'-?\d+(\.\d+)?', oz.get(k, '')) else v
    w, h, baslik = sayi('w', 1440), sayi('h', 900), oz.get('baslik') or ad[:-8]
    with kilit:
        boards = canvas_oku().get('boards', {})
        # Aynı adda pano başka sayfadaysa (başka alanın panosu) üstüne yazılmaz: yeni ad alır
        if os.path.exists(os.path.join(PROJE, ad)) and ad in boards and boards[ad].get('page') != bag['sayfa']:
            kok_ad, n = ad[:-8], 2
            while os.path.exists(os.path.join(PROJE, f'{kok_ad}{n}.dc.html')):
                n += 1
            ad = f'{kok_ad}{n}.dc.html'
        yeni = not os.path.exists(os.path.join(PROJE, ad))
        if yeni:
            _pano_dosya_yaz(ad, pano_sar(f'<div style="width: {w:g}px; height: {h:g}px; background: var(--zemin)"></div>', baslik, w, h))
        else:
            pano_surumu(ad)
        istek = {'ad': ad, 'sayfa': bag['sayfa'], 'baslik': baslik, 'w': w, 'h': h}
        yer = bag.pop('yer', None) if yeni else None  # hızlı eylemin ya da bölgenin yeri turun ilk yeni panosuna
        for k in ('x', 'y'):
            v = sayi(k, (yer or {}).get(k))
            if isinstance(v, (int, float)):
                istek[k] = v
        try:
            konum = pano_yerlestir(istek)
        except ValueError:
            return None
    a = {'ad': ad, 'baslik': baslik, 'w': w, 'h': h, 'x': konum['x'], 'y': konum['y'], 'yeni': yeni}
    PANO_AKIS[ad] = {**a, 'icerik': '', 'thread': thread}
    _pano_yayinla(threadId=thread, basla=True, bas=0, parca='', **a)
    return a


def _pano_parca(a, thread, parca):
    kayit = PANO_AKIS.get(a['ad'])
    if kayit is None:
        return
    bas = len(kayit['icerik'])
    kayit['icerik'] += parca
    _pano_yayinla(threadId=thread, ad=a['ad'], bas=bas, parca=parca)


def _pano_bitir(a, thread, icerik, yarim):
    """Blok kapandı (ya da mesaj bloğu kapatmadan bitti): dosya yazılır, tuval gerçeğini yükler."""
    _pano_dosya_yaz(a['ad'], pano_sar(icerik, a['baslik'], a['w'], a['h']))
    kayit = PANO_AKIS.pop(a['ad'], None) or {}
    _pano_yayinla(threadId=thread, ad=a['ad'], bas=len(kayit.get('icerik', '')), parca='', bitti=True, yarim=bool(yarim), yol='panolar/' + a['ad'])
    if PANO_BOY_DENETIMI and not yarim:
        threading.Thread(target=_pano_boy_duzelt, args=(a['ad'],), daemon=True).start()


PANO_BOY_DENETIMI = True


def _pano_boy_duzelt(ad):
    """Akışla gelen panoyu Codex denetlemez (hız için): içerik panodan uzunsa panonun boyu içeriğe çekilir, alt kısım kesilmesin."""
    try:
        c = subprocess.run(['node', os.path.join(BEYIN, 'araclar', 'pano.mjs'), ad], cwd=BEYIN, capture_output=True, text=True, timeout=120)
    except (OSError, subprocess.TimeoutExpired):
        return
    m = re.search(r'TAŞMA içerik (\d+)px, pano (\d+)px', c.stdout + c.stderr)
    if not m or int(m.group(1)) > int(m.group(2)) * 3:
        return
    boy = int(m.group(1))
    with kilit:
        tuval = canvas_oku()
        b = tuval.get('boards', {}).get(ad)
        if not b or ad in PANO_AKIS:  # bu arada kaldırıldı ya da yeniden çiziliyor
            return
        b['h'] = boy
        canvas_yaz(tuval)
        try:
            with open(os.path.join(PROJE, ad), encoding='utf-8') as f:
                metin = f.read()
        except OSError:
            return
        yeni = re.sub(r'("\$preview":\{"width":\d+,"height":)\d+', lambda k: k.group(1) + str(boy), metin, count=1)
        if yeni != metin:
            _pano_dosya_yaz(ad, yeni)


def _pano_ilerle(st, son):
    """Biriken mesaj metninde blokları ilerletir. son: mesaj bitti, kapanmamış blok eldekiyle yazılır."""
    while True:
        a = st['acik']
        if a is None:
            m = PANO_AC.search(st['metin'], st['imlec'])
            if not m:
                return
            a = _pano_baslat(st['thread'], dict(re.findall(r'([a-z]+)="([^"]*)"', m.group(1)))) or {'atla': True}
            a['bas'] = a['yollanan'] = m.end()
            st['acik'] = a
        kapanis = st['metin'].find(PANO_KAPA, a['bas'])
        # Kapanış etiketi yarım gelmiş olabilir: son karakterler bir sonraki parçaya kadar tutulur
        bitis = kapanis if kapanis >= 0 else len(st['metin']) if son else max(a['yollanan'], len(st['metin']) - len(PANO_KAPA))
        if not a.get('atla') and bitis > a['yollanan'] and (kapanis >= 0 or son or bitis - a['yollanan'] >= 40):
            _pano_parca(a, st['thread'], st['metin'][a['yollanan']:bitis])
            a['yollanan'] = bitis
        if kapanis < 0 and not son:
            return
        if not a.get('atla'):
            _pano_bitir(a, st['thread'], st['metin'][a['bas']:bitis], kapanis < 0)
        st['imlec'], st['acik'] = bitis + (len(PANO_KAPA) if kapanis >= 0 else 0), None
        if kapanis < 0:
            return


def _pano_isle(m):
    y, p = m.get('method'), m.get('params') or {}
    bos = lambda: {'thread': p.get('threadId'), 'metin': '', 'imlec': 0, 'acik': None}
    if y == 'item/agentMessage/delta':
        st = _pano_durum.setdefault(p.get('itemId'), bos())
        st['metin'] += p.get('delta') or ''
        _pano_ilerle(st, False)
    elif y == 'item/completed':
        it = p.get('item') or {}
        st, tam = _pano_durum.pop(it.get('id'), None) or bos(), it.get('text') or ''
        if tam.startswith(st['metin']):  # parçalar eksik geldiyse mesajın tamamı esas
            st['metin'] = tam
        _pano_ilerle(st, True)
    elif y == 'turn/completed':
        for k in [k for k, st in _pano_durum.items() if st['thread'] == p.get('threadId')]:
            _pano_ilerle(_pano_durum.pop(k), True)


def pano_bildirimi(m):
    """Kopru.bildirim: Codex'in okuyucu thread'inde çağrılır; yalnız ilgili bildirimi kuyruğa koyar."""
    y = m.get('method')
    if y == 'item/agentMessage/delta' or y == 'turn/completed' or (y == 'item/completed' and ((m.get('params') or {}).get('item') or {}).get('type') == 'agentMessage'):
        _pano_kuyruk.put(m)
        if not _pano_isci:
            _pano_isci.append(threading.Thread(target=_pano_dongu, daemon=True))
            _pano_isci[0].start()


def _pano_dongu():
    while True:
        m = _pano_kuyruk.get()
        try:
            _pano_isle(m)
        except Exception as e:  # bir panonun hatası akışı durdurmaz
            print('pano akışı:', str(e)[:200], flush=True)


KOPRU.bildirim = pano_bildirimi
KOPRU.izin_profili = izin_profili


# Tur sonu receipt'i (S-017): Codex her turda beyin skill'ini baştan okuyup receipt JSON'unu kendisi yazıp gönderiyordu (ölçülen
# çizim turunda hafıza işi yaklaşık 95 sn). Artık Beyin gönderir: Codex'in o turda yazdığı dosyalar, çizdiği panolar ve son
# cevabının özeti. Dosya yazılmayan (yalnız sohbet) turda receipt yok: her cevap bir iş parçası değil.
def tur_receipt(ozet):
    if ozet.get('durum') != 'completed' or not ozet.get('alan'):
        return
    time.sleep(3)  # pano akışı dosyayı yazsın, Defter kilidi izinsiz değişikliği geri alsın
    if not ozet['alan'].startswith('sayfa-') and not alan_bul(ozet['alan'])[1]:
        return  # alan bu arada kaldırılmış (sınamanın geçici alanı): yazılacak kayıt silinmiş dosyalara bağlanırdı
    mesajlar = [m for m in ozet.get('mesajlar') or [] if m]
    cevap = mesajlar[-1] if mesajlar else ''
    panolar = ['panolar/' + ad for ad in re.findall(r'<pano-yaz\b[^>]*\bad="([^"]+)"', '\n'.join(mesajlar)) if AD.match(ad)]
    refs = [r for r in dict.fromkeys([*ozet.get('yazdi', []), *panolar])
            if r and not r.startswith(('.', '/')) and os.path.exists(os.path.join(BEYIN, r))][:12]
    if not refs:
        return
    metin = re.sub(r'\s+', ' ', re.sub(r'<pano-yaz\b.*?(</pano-yaz>|$)', '', cevap, flags=re.S)).strip()[:600]
    yol = os.path.join(DURUM, 'tur-receipt-' + str(ozet.get('thread') or 'x')[:8] + '.json')
    with open(yol, 'w', encoding='utf-8') as f:
        json.dump({'event_id': f"beyin-{ozet['alan']}-{time.strftime('%Y%m%d%H%M%S')}", 'refs': refs, 'visibility': 'internal',
                   'summary': metin or 'Codex bu turda dosya yazdı.'}, f, ensure_ascii=False)
    try:  # önce eşitle: Codex bu oturumlarda sync çalıştırmaz (hook'lar kapalı), yazdığı dosya beyne böyle girer
        subprocess.run([sys.executable, os.path.join(BEYIN, 'beyin.py'), 'sync'], cwd=BEYIN, capture_output=True, text=True, timeout=120)
        c = subprocess.run([sys.executable, os.path.join(BEYIN, 'beyin.py'), 'receipt', '--file', yol, '--harness', 'codex'],
                           cwd=BEYIN, capture_output=True, text=True, timeout=90)
        if c.returncode:
            hata_yaz({'kaynak': 'receipt', 'mesaj': (c.stderr or c.stdout)[-300:], 'yer': ozet['alan']})
    except (OSError, subprocess.TimeoutExpired) as e:
        hata_yaz({'kaynak': 'receipt', 'mesaj': str(e)[:300], 'yer': ozet['alan']})


KOPRU.tur_ozeti = lambda ozet: threading.Thread(target=tur_receipt, args=(ozet,), daemon=True).start()

# Çizim turlarının hız katmanı (K-077): Codex'in "Fast" katmanı (priority). Boş bırakılırsa standart; Ultrafast açılırsa 'ultrafast'.
CIZIM_KATMANI = os.environ.get('BEYIN_CIZIM_KATMANI', 'priority')


YERINDE = "Aynı panoyu güncelle: adı ve yeri değişmez (önceki sürüm saklandı)."
PANO_EYLEMLERI = {
    'revize': "Seçili panoyu şu isteğe göre revize et: {istek}. " + YERINDE,
    'bastan': "Seçili panoyu baştan çiz: aynı konuyu güncel notlara göre daha açık, daha düzenli kur. " + YERINDE,
    'genislet': "Seçili panoyu genişlet: alt konular, açık sorular ve sonraki adımlar. Bunları yeni bir panoda çiz; seçili panoya dokunma.",
    'dogrula': ("Seçili panodaki iddiaları <ilgili_notlar>, alanın Defter'i ve kaynaklarla karşılaştır. Her iddiaya bir satır: dayanağı var "
                "(kaynağını an), varsayım ya da çelişkili. Pano çizme, panoyu değiştirme; cevabı kısa liste olarak ver."),
    'kumele': ("Seçili panoları kümele: ortak temaları bul, tekrarı birleştir, çelişkiyi ayrı göster. Kümeleri tek yeni panoda topla, "
               "her kümede hangi panodan geldiğini an; seçili panolara dokunma."),
    'birlestir': ("Seçili panoları tek yeni panoda birleştir: tekrarı at, çelişkiyi açıkça göster, kaynak panoları an; seçili panolara dokunma."),
    'karsilastir': ("Seçili panoları karşılaştır: benzerlikler, farklar, birinin atladığını öbürü nasıl ele alıyor. Yan yana bir karşılaştırma "
                    "panosu çiz; seçili panolara dokunma."),
}


def pano_surumu(ad):
    """Revizeden önce panonun kopyası: .durum/pano-surum/<Ad>-<zaman>.dc.html."""
    kaynak = os.path.join(PROJE, ad)
    if AD.match(ad) and os.path.isfile(kaynak):
        hedef = os.path.join(DURUM, 'pano-surum')
        os.makedirs(hedef, exist_ok=True)
        shutil.copy2(kaynak, os.path.join(hedef, ad.replace('.dc.html', '') + '-' + zaman.strftime('%Y%m%d-%H%M%S') + '.dc.html'))


def eylem_bloku(eylem, panolar, sayfa=''):
    """<pano_eylemi>: hızlı eylemin istemi. Revizede önce sürüm kopyası alınır."""
    if not isinstance(eylem, dict) or not panolar:
        return None
    ad, istek = eylem.get('ad'), str(eylem.get('istek') or '').strip()[:600]
    if ad == 'revize' and not istek:
        ad = 'bastan'
    if ad not in PANO_EYLEMLERI:
        return None
    if ad in ('revize', 'bastan'):
        for p in panolar[:1]:
            pano_surumu(p)
    metin = PANO_EYLEMLERI[ad].replace('{istek}', istek)
    yer = eylem.get('yer')
    if ad not in ('revize', 'bastan', 'dogrula') and isinstance(yer, dict) and all(isinstance(yer.get(k), (int, float)) for k in ('x', 'y')):
        metin += (f" Yeni panoyu '{sayfa}' sayfasında x={round(yer['x'])}, y={round(yer['y'])} konumuna koy (genişlik {round(yer.get('w') or 1440)}); "
                  f"orası boş: <pano-yaz> bloğuna x=\"{round(yer['x'])}\" y=\"{round(yer['y'])}\" yaz.")
    return ('<pano_eylemi>\nKullanıcı tuvalde seçili panolar için bu hızlı eylemi seçti; mesajdaki kısa ad budur. Bu blok '
            "<cizim_modu>'nun hangi panoyu güncelleyeceğine dair kuralından önce gelir.\n" + metin + '\n</pano_eylemi>')


def tur_ekleri(istek):
    """Mesajın yanında Codex'e giden etiketli bloklar: seni tanıyan katman, ilgili notlar, çizim modu, seçili pano.
    Bloklar kullanıcı mesajı gibi görünmez (panel ve arşiv etiketli metni ayıklar)."""
    alan, ekler = istek['alan'], []
    kimlik = alan[len('sayfa-'):] if alan.startswith('sayfa-') else ''  # Sayfalar: her sayfanın kendi Codex'i
    ca, a = (None, None) if kimlik else alan_bul(alan)
    izole = bool(ca and ca.get('izole'))
    haric, haric_proje = gizli_haric((ca or {}).get('id'))
    # Aynı bağlam her turda yeniden gitmesin (S-017): thread geçmişi zaten taşıyor. Kimlik değişince ya da 10 turda bir yeniden,
    # bir not 10 tur içinde bir kez. İz codex-gorevler.json'da; yeni thread boş başlar ve hepsini alır.
    iz = KOPRU.gonderilen(alan)
    tur = iz.get('tur', 0) + 1
    ben = hafiza.ben_baglami(BEYIN, izole)
    ozet = hashlib.sha1((ben or '').encode()).hexdigest()[:12]
    if ben and (ozet != iz.get('ben') or tur - iz.get('ben_tur', 0) >= 10):
        ekler.append(ben)
        istek['_iz'] = {'ben': ozet, 'ben_tur': tur}
    yakin = {k: t for k, t in (iz.get('notlar') or {}).items() if tur - t < 10}
    notlar = hafiza.notlar_baglami(BEYIN, istek['metin'], ca['id'] if izole else None, haric, haric_proje, atla=set(yakin))
    if notlar:
        ekler.append(notlar)
        yakin.update({k: tur for k in re.findall(r'^- (\S+)', notlar, re.M)})
    istek['_iz'] = {**istek.get('_iz', {}), 'tur': tur, 'notlar': yakin}
    if not kimlik:
        try:
            kural = yazma_kurali(alan)
            if kural:
                ekler.append(kural)
        except (OSError, ValueError):
            pass
    if istek.get('sayfa') and not kimlik:  # alanın notu açıkken Codex onu da görür
        try:
            ekler.append(sayfa_bloku(istek['sayfa']))
        except (ValueError, OSError):
            pass
    if kimlik:
        ekler.append(sayfa_bloku(kimlik))
        with kilit:
            sayfa = sayfa_tuvali({'id': kimlik})
    else:
        sayfa = (a or {}).get('sayfa') or ''
    if istek.get('ciz'):
        # Tam tarif thread'e bir kez (ve 10 turda bir) gider, sonra kısa hatırlatma (S-017: aynı bağlam her turda yeniden gitmesin)
        tam = iz.get('tarif') != TARIF_SURUMU or tur - iz.get('tarif_tur', 0) >= 10
        if tam:
            istek['_iz'] = {**istek.get('_iz', {}), 'tarif': TARIF_SURUMU, 'tarif_tur': tur}
        ekler.append('<cizim_modu>\nÇizim modu açık: bu mesaja cevap verirken konuşulan fikri bir panoda görselleştir; izin isteme, soru sorma. '
                     'Erken taslak yeter: hızlı, okunur, mükemmel değil. Pano yalnız gösterilecek yeni bir şey varsa: kaynak sorusu ("nereden '
                     'aldın"), onay, teşekkür ya da kısa soru gibi mesajlarda pano verme, metinle cevap ver. Bir turda en çok bir pano bloğu, '
                     'cevabın başında; ara mesajlarda ("şuna bakıyorum") pano verme.\n'
                     f"Bu {'sayfanın' if kimlik else 'alanın'} tuval sayfası '{sayfa}'. Bu konuşmada çizdiğin pano varsa onu güncelle; konu değiştiyse yeni pano aç. "
                     + (yerlestir_tarifi(sayfa) if tam else "Panoyu bu konuşmada verilen tarifle ver: cevabının başında <pano-yaz ad= baslik= w= h=> bloğu, "
                        "içinde <helmet> ve tek kök <div>; dosyaya yazma, PANO.md ve tema.css'i yeniden okuma.") +
                     '\nCevabın kısa olsun: bloktan sonra neyi çizdiğini bir cümleyle söyle.\n</cizim_modu>')
    panolar = [p for p in (istek.get('panolar') or ([istek['pano']] if istek.get('pano') else [])) if isinstance(p, str) and AD.match(p)][:20]
    if panolar:
        boards = canvas_oku().get('boards', {})
        satirlar = '\n'.join(f'- panolar/{p} ("{(boards.get(p) or {}).get("title", "")}")' for p in panolar)
        ekler.append(f'<pano>\nKullanıcı tuvalde bu panoları seçti; mesaj bunlarla ilgili:\n{satirlar}\n</pano>')
        blok = eylem_bloku(istek.get('eylem'), panolar, sayfa)
        if blok:
            ekler.append(blok)
    b = istek.get('bolge')
    if isinstance(b, dict) and all(isinstance(b.get(k), (int, float)) for k in ('x', 'y', 'w', 'h')):
        ekler.append(f"<bolge>\nKullanıcı '{sayfa}' sayfasında boş bir bölge seçti: x={round(b['x'])}, y={round(b['y'])}, "
                     f"genişlik={round(b['w'])}, yükseklik={round(b['h'])}. Bu mesajda pano çizersen onu bu bölgeye koy: "
                     "<pano-yaz> bloğuna x, y (bölgenin sol üstü) ve bölgeye uyan w yaz.\n</bolge>")
    # Canlı çizim (K-077): bu turun panosu hangi sayfaya, yeni pano hangi yere (bölge ya da hızlı eylemin yeri)
    yer = b if isinstance(b, dict) and all(isinstance(b.get(k), (int, float)) for k in ('x', 'y')) else (istek.get('eylem') or {}).get('yer') if isinstance(istek.get('eylem'), dict) else None
    istek['_pano'] = {'sayfa': sayfa, 'yer': {'x': yer['x'], 'y': yer['y']} if isinstance(yer, dict) and all(isinstance(yer.get(k), (int, float)) for k in ('x', 'y')) else None}
    return ekler


HARF = {'karar': 'K', 'soru': 'S', 'ilke': 'I', 'kaynak': 'R'}


def not_yaz(istek):
    """Codex mesajı ya da panelden yeni not: sıradaki numara ve akış, konusuz başlar (konu sonra verilir)."""
    alan, tur = kisa_ad(istek['alan']), istek['tur']
    harf, metin = HARF[tur], (istek.get('metin') or '').strip()
    if not metin:
        raise ValueError('not boş')
    klasor = os.path.join(NOTLAR, alan)
    if not alan_bul(alan)[1] and not os.path.isdir(klasor):  # program alanları calisma.json'da; klasör ilk notla açılır
        raise ValueError('alan yok')
    os.makedirs(klasor, exist_ok=True)
    var_ = [n for n in notlar() if n['alan'] == alan]
    sira = max([int(n['no'][2:]) for n in var_ if n.get('no', '').startswith(harf + '-') and n['no'][2:].isdigit()] or [0]) + 1
    akis = max([int(n.get('akis') or 0) for n in var_] or [0]) + 1
    no = f'{harf}-{sira:03d}'
    baslik = istek.get('baslik') or re.split(r'(?<=[.!?])\s', metin.replace('\n', ' '))[0][:90]
    govde = metin + ('\n\n**Kaynak:** ' + istek['kaynak'] if istek.get('kaynak') else '')
    yol = os.path.join(klasor, f'{no}-{kisa_ad(baslik)[:40]}.md')
    alanlar = {'no': no, 'id': f'{alan}-{no}', 'tur': tur, 'baslik': baslik.replace('\n', ' '), 'pano': istek.get('pano', ''), 'bolum': istek.get('bolum', 'Codex'),
               'konu': istek.get('konu', ''), 'veren': istek.get('veren', 'codex'), 'durum': 'acik' if tur == 'soru' else 'verildi',
               'tarih': date.today().isoformat(), 'akis': akis, 'konusma': istek.get('konusma', '')}
    with open(yol, 'w', encoding='utf-8') as f:
        f.write('---\n' + ''.join(f'{k}: {v}\n' for k, v in alanlar.items()) + '---\n' + govde + '\n')
    return no


def blob_turu(yol):
    try:
        with open(yol, 'rb') as f:
            bas = f.read(256)
    except OSError:
        return 'application/octet-stream'
    if bas.startswith(b'\x89PNG'):
        return 'image/png'
    if bas.startswith(b'\xff\xd8'):
        return 'image/jpeg'
    if bas.startswith(b'GIF8'):
        return 'image/gif'
    if bas[:4] == b'RIFF' and bas[8:12] == b'WEBP':
        return 'image/webp'
    if bas.startswith(b'wOF2'):
        return 'font/woff2'
    if b'<svg' in bas or bas.lstrip().startswith(b'<?xml'):
        return 'image/svg+xml'
    return 'application/octet-stream'


class Istek(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def gonder(self, kod, govde, tur='application/json; charset=utf-8', onbellek=False):
        self.send_response(kod)
        self.send_header('Content-Type', tur)
        self.send_header('Content-Length', str(len(govde)))
        self.send_header('Cache-Control', 'max-age=31536000' if onbellek else 'no-store')
        self.end_headers()
        self.wfile.write(govde)

    def parcali(self, yol, tur):
        """Video: bayt aralığıyla verir (206), tarayıcı ileri sarabilsin (K-045 video görünümü)."""
        boy = os.path.getsize(yol)
        m = re.match(r'bytes=(\d*)-(\d*)', self.headers.get('Range', ''))
        bas, son = 0, boy - 1
        if m and m.group(1):
            bas, son = int(m.group(1)), int(m.group(2)) if m.group(2) else boy - 1
        elif m and m.group(2):
            bas = max(0, boy - int(m.group(2)))
        son = min(son, boy - 1)
        self.send_response(206 if m else 200)
        self.send_header('Content-Type', tur)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(son - bas + 1))
        if m:
            self.send_header('Content-Range', f'bytes {bas}-{son}/{boy}')
        self.end_headers()
        with open(yol, 'rb') as f:
            f.seek(bas)
            kalan = son - bas + 1
            while kalan > 0:
                parca = f.read(min(1 << 16, kalan))
                if not parca:
                    break
                self.wfile.write(parca)
                kalan -= len(parca)

    def hata(self, kod, metin):
        self.gonder(kod, json.dumps({'hata': metin}, ensure_ascii=False).encode())

    def dosya(self, yol, tur=None, onbellek=False):
        try:
            with open(yol, 'rb') as f:
                veri = f.read()
        except OSError:
            return self.hata(404, 'Dosya yok')
        self.gonder(200, veri, tur or TUR.get(os.path.splitext(yol)[1], 'application/octet-stream'), onbellek)

    def akis(self, sorgu):
        """Codex olayları (SSE). Sunucu yeniden başladıysa sıra baştan sayılır."""
        son = max(int(sorgu.get('son') or 0), int(self.headers.get('Last-Event-ID') or 0))
        if son > KOPRU.sira:
            son = 0
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        try:
            while True:
                olaylar = KOPRU.bekle(son, 15)
                if not olaylar:
                    self.wfile.write(b': nabiz\n\n')
                for o in olaylar:
                    self.wfile.write(f'id: {o["sira"]}\ndata: {json.dumps(o, ensure_ascii=False)}\n\n'.encode())
                    son = o['sira']
                self.wfile.flush()
        except OSError:
            return

    def do_GET(self):
        yol = unquote(urlparse(self.path).path)
        sorgu = {k: v[0] for k, v in parse_qs(urlparse(self.path).query).items()}
        if yol in ('/', '/pano', '/tek.html'):
            sayfa = {'/': 'beyin.html', '/pano': 'index.html'}.get(yol, 'tek.html')
            with open(os.path.join(KOK, sayfa), encoding='utf-8') as f:
                return self.gonder(200, f.read().replace('{{BEYIN_AD}}', AD_).encode(), 'text/html; charset=utf-8')
        if yol == '/sw.js':  # servis çalışanı kökten verilir ki bütün programı kapsasın (K-031)
            return self.dosya(os.path.join(KOK, 'uygulama', 'sw.js'))
        if yol == '/uygulama/manifest.webmanifest':
            with open(os.path.join(KOK, 'uygulama', 'manifest.webmanifest'), encoding='utf-8') as f:
                return self.gonder(200, f.read().replace('{{BEYIN_AD}}', AD_).encode(), TUR['.webmanifest'])
        if yol.startswith('/uygulama/') and re.fullmatch(r'/uygulama/[a-z0-9-]+\.(png|svg|html)', yol):
            return self.dosya(os.path.join(KOK, yol.lstrip('/')))
        if yol == '/api/sayfalar':
            try:
                liste = sayfalar.hepsi(BEYIN) if sorgu.get('hepsi') else sayfalar.liste(BEYIN, sorgu.get('alan', ''))
                return self.gonder(200, json.dumps(liste, ensure_ascii=False).encode())
            except ValueError:
                return self.hata(400, 'alan geçersiz')
        if yol == '/api/sayfa':
            try:
                return self.gonder(200, json.dumps(sayfalar.oku(BEYIN, sorgu.get('id', '')), ensure_ascii=False).encode())
            except (ValueError, OSError):
                return self.hata(404, 'Sayfa yok')
        if yol == '/api/notlar':
            return self.gonder(200, json.dumps(notlar(), ensure_ascii=False).encode())
        if yol == '/api/pano-akis':  # süren canlı çizimler (K-077): tuval sonradan açılırsa buradan tamamlar
            return self.gonder(200, json.dumps({ad: {k: v for k, v in a.items() if k != 'thread'} for ad, a in PANO_AKIS.items()}, ensure_ascii=False).encode())
        if yol == '/api/dogrula':
            return self.gonder(200, json.dumps(dogrula_bekleyen(), ensure_ascii=False).encode())
        if yol == '/api/alan-durum':
            return self.gonder(200, json.dumps(alan_durum(), ensure_ascii=False).encode())
        if yol == '/api/ikon-durum':
            return self.gonder(200, json.dumps(ikon_durum(), ensure_ascii=False).encode())
        if yol == '/api/video-detay':
            try:
                return self.gonder(200, json.dumps(video_detay(sorgu.get('no', '')), ensure_ascii=False).encode())
            except StopIteration:
                return self.hata(404, 'Video bulunamadı')
        if yol == '/api/kaynaklar':
            try:
                return self.gonder(200, json.dumps(kaynaklar(sorgu.get('alan', '')), ensure_ascii=False).encode())
            except ValueError as e:
                return self.hata(404, str(e))
        if yol == '/api/ag':
            return self.gonder(200, json.dumps(ag_verisi(), ensure_ascii=False).encode())
        if yol == '/api/saglik':
            return self.gonder(200, json.dumps(saglik(), ensure_ascii=False).encode())
        if yol == '/api/tarama':
            return self.gonder(200, json.dumps(tarama_oku(), ensure_ascii=False).encode())
        if yol == '/api/cop':
            return self.gonder(200, json.dumps(cop(), ensure_ascii=False).encode())
        if yol == '/api/calisma':
            return self.gonder(200, json.dumps(calisma_ozeti(), ensure_ascii=False).encode())
        if yol == '/api/veri':
            return self.gonder(200, json.dumps(veriler(sorgu.get('calisma'), sorgu.get('alan'))[:200], ensure_ascii=False).encode())
        if yol == '/api/konusmalar':
            return self.gonder(200, json.dumps(konusmalar(), ensure_ascii=False).encode())
        if yol == '/api/durum':
            with kilit:
                veri = json.dumps(durum).encode()
            return self.gonder(200, veri)
        if yol in ('/ag.js', '/codex-panel.js', '/sayfa.js', '/kurulum.js', '/ogretici.js'):
            return self.dosya(os.path.join(KOK, yol.lstrip('/')), 'text/javascript; charset=utf-8')
        if yol == '/api/codex/akis':
            return self.akis(sorgu)
        if yol == '/api/codex/gecmis':
            alan = sorgu.get('alan', '')
            try:
                g = KOPRU.gecmis(alan, codex_talimati(alan))
            except RuntimeError as e:
                return self.hata(503, str(e))
            g['istekler'] = KOPRU.acik_istekler(g['thread']) if g['thread'] else []
            g['sira'] = KOPRU.sira
            g['kok'] = BEYIN
            return self.gonder(200, json.dumps(g, ensure_ascii=False).encode())
        if yol == '/api/entegrasyon':
            return self.gonder(200, json.dumps(entegrasyonlar(), ensure_ascii=False).encode())
        if yol == '/api/surum':
            return self.gonder(200, json.dumps(surum_bilgisi(sorgu.get('zorla') == '1'), ensure_ascii=False).encode())
        if yol == '/api/hafiza':
            # Ayarlar: alttaki ortak beynin sürümü ve sağlık özeti
            try:
                surum = open(os.path.join(BEYIN, '.beyin-version'), encoding='utf-8').read().strip()
                doktor = subprocess.run([sys.executable, os.path.join(BEYIN, 'beyin.py'), 'doctor', '--human'], cwd=BEYIN,
                                        capture_output=True, text=True, timeout=30).stdout.strip()
            except (OSError, subprocess.TimeoutExpired):
                surum, doktor = '', ''
            return self.gonder(200, json.dumps({'surum': surum, 'doktor': doktor}, ensure_ascii=False).encode())
        if yol == '/api/hatalar':
            return self.gonder(200, json.dumps(hatalar(int(sorgu.get('son') or 40)), ensure_ascii=False).encode())
        if yol == '/api/pano-denetle':
            # Codex sandbox'ta tarayıcı açamaz: denetimi sunucu yapar, sonucu döner
            ad = sorgu.get('ad', '')
            if not AD.match(ad) or not os.path.exists(os.path.join(PROJE, ad)):
                return self.hata(404, 'Pano yok')
            try:
                c = subprocess.run(['node', os.path.join(BEYIN, 'araclar', 'pano.mjs'), ad], cwd=BEYIN, capture_output=True, text=True, timeout=120)
                cikti = (c.stdout + c.stderr).strip()
            except (OSError, subprocess.TimeoutExpired) as e:
                cikti = 'Denetlenemedi: ' + str(e)[:200]
            return self.gonder(200, json.dumps({'cikti': cikti}, ensure_ascii=False).encode())
        if yol == '/api/ben':
            return self.gonder(200, json.dumps(hafiza.ben_oku(BEYIN), ensure_ascii=False).encode())
        if yol == '/api/codex/modeller':
            try:
                return self.gonder(200, json.dumps(KOPRU.modeller(), ensure_ascii=False).encode())
            except RuntimeError as e:
                return self.hata(503, str(e))
        if yol == '/api/codex/olcum':
            # Tur ölçümü (S-017): son turlar ve seviyeye göre ortanca süre; Codex program alanında kendi hızına buradan bakar
            son = KOPRU.olcumler(int((parse_qs(urlparse(self.path).query).get('son') or ['40'])[0]))
            ortanca = lambda l: sorted(l)[len(l) // 2] if l else None
            # Hız katmanı gelince (K-077) seviye ve katman birlikte gruplanır: Fast ve standart turlar aynı ortancaya karışmasın
            grup = lambda o: str(o.get('efor')) + ('' if o.get('katman') in (None, 'standart') else ' · ' + o['katman'])
            ozet = {e: {'tur': len(l), 'toplam_sn': ortanca([o['toplam'] for o in l]), 'ilk_soz_sn': ortanca([o['ilk_soz'] for o in l if 'ilk_soz' in o]),
                        'ilk_pano_sn': ortanca([o['ilk_pano'] for o in l if 'ilk_pano' in o]),
                        'adim': ortanca([o['adim'] for o in l])} for e in {grup(o) for o in son} for l in [[o for o in son if grup(o) == e]]}
            return self.gonder(200, json.dumps({'ozet': ozet, 'turlar': son}, ensure_ascii=False).encode())
        if yol == '/api/codex/durum':
            # aktif: turu süren alanlar; sunucuyu yeniden başlatmadan önce bakılır (tur kesilmesin)
            aktif = [a for a, k in KOPRU.gorevler.items() if k.get('thread') in KOPRU.aktif_tur]
            return self.gonder(200, json.dumps({'calisiyor': KOPRU.calisiyor(), 'hata': KOPRU.hata, 'gorevler': KOPRU.gorevler, 'aktif': aktif}, ensure_ascii=False).encode())
        if yol.startswith('/ham/'):
            # Ham katman salt okunur: konuşma kaydı ve eklenen veri tarayıcıda açılır
            hedef = os.path.realpath(os.path.join(BEYIN, yol.lstrip('/')))
            if not hedef.startswith(os.path.realpath(os.path.join(BEYIN, 'ham')) + os.sep):
                return self.hata(404, 'Adres yok')
            uz = os.path.splitext(hedef)[1].lower()
            if uz in VIDEO_UZANTI and os.path.isfile(hedef):
                return self.parcali(hedef, {'.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska'}.get(uz, 'video/mp4'))
            tur = 'text/plain; charset=utf-8' if uz in ('.md', '.txt', '.csv', '.json') else blob_turu(hedef)
            return self.dosya(hedef, tur)
        parca = yol.strip('/').split('/')
        if len(parca) == 2 and AD.match(parca[1]):
            klasor, ad = parca
            if klasor == 'project':
                return self.dosya(MOTOR if ad == 'support.js' else os.path.join(PROJE, ad))
            if klasor == '_blob':
                yer = os.path.join(BLOB, ad)
                return self.dosya(yer, blob_turu(yer), onbellek=True)
            if klasor == 'resim':
                return self.dosya(os.path.join(RESIM, ad), 'image/png', onbellek=True)
        self.hata(404, 'Adres yok')

    def do_POST(self):
        yol = urlparse(self.path).path
        if yol == '/api/kapat':
            # Beyin'i kapatır (K-076; Ayarlar › Program ve "Beyni Kapat"): Codex turu sürüyorsa kesmemek için reddeder
            aktif = [a for a, k in KOPRU.gorevler.items() if k.get('thread') in KOPRU.aktif_tur]
            if aktif:
                return self.hata(409, 'Codex çalışıyor, turu bitince kapat')
            self.gonder(200, b'{"tamam":true}')
            threading.Thread(target=kapan, daemon=True).start()
            return
        if yol == '/api/guncelle':
            # Güncelle ya da geri al: yalnız program dosyaları değişir, veri dokunulmaz; sonra kabuk sunucuyu yeniden başlatır
            istek = json.loads(self.rfile.read(int(self.headers.get('Content-Length', '0'))) or b'{}')
            if gelistirici_kopya():
                return self.hata(409, 'Bu kopya programın kaynağı: güncelleme buradan yayınlanır, kurulmaz')
            if any(k.get('thread') in KOPRU.aktif_tur for k in KOPRU.gorevler.values()):
                return self.hata(409, 'Codex çalışıyor, turu bitince güncelle')
            if not GUNCELLE_KILIT.acquire(blocking=False):
                return self.hata(409, 'Güncelleme zaten sürüyor')
            try:
                sonuc = guncelle.geri(BEYIN) if istek.get('is') == 'geri' else guncelle.kur(BEYIN)
            except Exception as e:  # ağ, bozuk paket, korunan yere yazma isteği: hiçbir dosya değişmeden döner
                return self.hata(503, 'Güncellenemedi: ' + str(e)[:200])
            finally:
                GUNCELLE_KILIT.release()
            return self.gonder(200, json.dumps({'tamam': True, 'sonuc': sonuc}, ensure_ascii=False).encode())
        if yol == '/api/yeniden-baslat':
            # Python değişikliği için: Codex turu sürüyorsa kesmemek için reddeder; yoksa cevap verip kendini yeniden yükler
            aktif = [a for a, k in KOPRU.gorevler.items() if k.get('thread') in KOPRU.aktif_tur]
            if aktif:
                return self.hata(409, 'Codex çalışıyor, turu bitince yeniden dene')
            self.gonder(200, b'{"tamam":true}')
            threading.Thread(target=yeniden_yukle, daemon=True).start()
            return
        if yol.startswith('/api/codex/'):
            try:
                istek = json.loads(self.rfile.read(int(self.headers.get('Content-Length', '0'))) or b'{}')
                if yol == '/api/codex/gonder':
                    kopya = defter_dosyalari(istek['alan']) if alan_bul(istek['alan'])[1] else None
                    ekler = tur_ekleri(istek)
                    PANO_BAGLAM[istek['alan']] = istek.get('_pano') or {}  # akış başlamadan hazır olmalı (K-077)
                    sonuc = KOPRU.gonder(istek['alan'], istek['metin'], codex_talimati(istek['alan']), ekler,
                                         istek.get('model'), istek.get('efor'), istek.get('internet'), CIZIM_KATMANI if istek.get('ciz') else None)
                    KOPRU.isaretle(istek['alan'], **istek.get('_iz', {}))
                    if kopya is not None:
                        defter_kilidi_kur(istek['alan'], sonuc['thread'], istek['metin'], kopya)
                elif yol == '/api/codex/oneri':
                    sonuc = yazi_onerisi(istek)
                elif yol == '/api/codex/yazi':
                    sonuc = yazi_kutusu(istek)
                elif yol == '/api/codex/tara':
                    sonuc = tarama_baslat(istek)
                elif yol == '/api/codex/cevap':
                    sonuc = KOPRU.cevapla(istek['istekId'], istek['sonuc'])
                elif yol == '/api/codex/dur':
                    sonuc = KOPRU.dur(istek['alan'])
                else:
                    return self.hata(404, 'Adres yok')
            except (ValueError, KeyError, TypeError) as e:
                return self.hata(400, 'Geçersiz istek: ' + str(e)[:80])
            except RuntimeError as e:
                return self.hata(503, str(e)[:200])
            return self.gonder(200, json.dumps({'tamam': True, 'sonuc': sonuc}, ensure_ascii=False).encode())
        if yol in ('/api/veri', '/api/calisma', '/api/alan', '/api/izole', '/api/not', '/api/ben', '/api/sayfa', '/api/sayfa-sil', '/api/sayfa-tuval', '/api/alan-not', '/api/hata',
                   '/api/kimlik', '/api/pano-yerlestir', '/api/dogrula', '/api/dogrula-ekle', '/api/ikon-ciz', '/api/alan-kaldir', '/api/calisma-kaldir', '/api/cop-geri', '/api/cop-sil', '/api/not-onay', '/api/alan-bilgi', '/api/video', '/api/alan-sira', '/api/tuval-oge', '/api/alan-tasi', '/api/calisma-sira', '/api/entegrasyon-eylem'):
            try:
                istek = json.loads(self.rfile.read(int(self.headers.get('Content-Length', '0'))) or b'{}')
                with kilit:
                    sonuc = {'/api/veri': veri_ekle, '/api/calisma': calisma_ekle, '/api/alan': alan_ekle, '/api/izole': izole_degis, '/api/not': not_yaz,
                             '/api/ben': lambda i: hafiza.ben_yaz(BEYIN, i), '/api/sayfa': sayfa_yaz,
                             '/api/sayfa-sil': sayfa_sil, '/api/sayfa-tuval': sayfa_tuvali,
                             '/api/alan-not': alan_notu, '/api/hata': hata_yaz, '/api/kimlik': kimlik_degis, '/api/pano-yerlestir': pano_yerlestir, '/api/dogrula': dogrula_karar,
                             '/api/dogrula-ekle': lambda i: bool(dogrula_ekle(i['alan'], i.get('iddia'), i.get('hedef'), i.get('bolum'), 'Codex')), '/api/ikon-ciz': ikon_ciz_sirala,
                             '/api/alan-kaldir': alan_kaldir, '/api/calisma-kaldir': calisma_kaldir,
                             '/api/cop-geri': cop_geri, '/api/cop-sil': cop_sil, '/api/not-onay': not_onay, '/api/alan-bilgi': alan_bilgi, '/api/video': video_ekle, '/api/alan-sira': alan_sira, '/api/tuval-oge': tuval_oge, '/api/alan-tasi': alan_tasi, '/api/calisma-sira': calisma_sira, '/api/entegrasyon-eylem': entegrasyon_eylem}[yol](istek)
            except StopIteration:
                return self.hata(404, 'Bulunamadı')
            except (ValueError, KeyError, TypeError, IndexError, OSError) as e:
                return self.hata(400, 'Olmadı: ' + str(e)[:80])
            return self.gonder(200, json.dumps({'tamam': True, 'sonuc': sonuc}, ensure_ascii=False).encode())
        if yol != '/api/tasi':
            return self.hata(404, 'Adres yok')
        try:
            istek = json.loads(self.rfile.read(int(self.headers.get('Content-Length', '0'))))
            tur, ad = istek['tur'], istek['ad']
            x, y = round(float(istek['x'])), round(float(istek['y']))
        except (ValueError, KeyError, TypeError):
            return self.hata(400, 'Geçersiz istek')
        with kilit:
            try:
                c = canvas_oku()
            except (OSError, ValueError):
                return self.hata(500, 'canvas.json okunamadı')
            hedef = c.get('boards' if tur == 'pano' else 'notes', {}).get(ad)
            if hedef is None:
                return self.hata(404, 'Pano ya da not bulunamadı')
            hedef['x'], hedef['y'] = x, y
            canvas_yaz(c)
        self.gonder(200, b'{"tamam":true}')


def kapan():
    """Cevap gittikten sonra kapanır. Alt süreçler (Codex, süren video işi) yetim kalmasın diye önce onlar; yarıda kalan video
    bir sonraki açılışta kaldığı yerden sürer."""
    time.sleep(0.6)
    print(f'{AD_}: kapatıldı', flush=True)
    subprocess.run(['pkill', '-TERM', '-P', str(os.getpid())], check=False)
    os._exit(0)


def yeniden_yukle():
    time.sleep(0.6)
    os.execv(sys.executable, [sys.executable] + sys.argv)  # Codex süreci boru kapanınca kendiliğinden kapanır


class Sunucu(ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        """Beklenmeyen sunucu hatası: günlüğe ve hatalar.jsonl'a (program alanındaki Codex görsün)."""
        import traceback
        hata_yaz({'kaynak': 'sunucu', 'mesaj': traceback.format_exc(limit=6)})
        super().handle_error(request, client_address)


if __name__ == '__main__':
    if not os.path.exists(os.path.join(PROJE, 'canvas.json')):  # yeni kurulum: boş tuval
        os.makedirs(PROJE, exist_ok=True)
        canvas_yaz({'v': 3, 'attachments': {}, 'boards': {}, 'pages': [], 'notes': {}, 'order': []})
    threading.Thread(target=gozcu, daemon=True).start()
    threading.Thread(target=resimci, daemon=True).start()
    os.makedirs(DURUM, exist_ok=True)
    projeleri_bagla(calisma_oku())
    # Açılışta Codex kendiliğinden başlamaz (K-074): eksik ikon çizilmez (alan açılırken bir kez ya da "İkon çizdir" ile),
    # süreç de ısıtılmaz; Codex bölmesi açılınca /api/codex/modeller süreci başlatır, yani ısınma kullanıcı bir alanı açınca olur
    print(f'{AD_}: http://127.0.0.1:{PORT}  (klasör {PROJE})', flush=True)
    Sunucu.allow_reuse_address = True
    # Yarıda kalan video işleri (sunucu yeniden başladı) yeniden sıraya girer
    with video_kilit:
        _vl = videolar_oku()
        for _v in _vl:
            if _v['asama'] not in ('bitti', 'hata', 'sirada'):
                _v['asama'] = 'sirada'
        videolar_yaz(_vl)
    if any(_v['asama'] == 'sirada' for _v in _vl):
        _video_isci()
    Sunucu(('127.0.0.1', PORT), Istek).serve_forever()
