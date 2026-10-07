#!/usr/bin/env python3
"""Beyin güncelleyici: GitHub'daki son sürümü indirir, yalnız program dosyalarını değiştirir.

Program dosyaları kökteki program.json'da yol ve sha256 ile listelidir. Kullanıcının verisi (notlar, sayfalar, panolar,
ben, knowledge, ham, calisma.json, .durum) listeye giremez ve hiç dokunulmaz; liste bunu isterse güncelleme reddedilir.
Kullanıcının elle değiştirdiği program dosyası ezilmeden önce yedeklenir ve çakışma olarak bildirilir (Codex birleştirir).
Her güncelleme değişen her dosyanın eski hâlini .durum/guncelleme/yedek-<sürüm>-<zaman>/ altına koyar; `geri` son
güncellemeyi geri alır. Yalnız standart kütüphane; model çağırmaz, not göndermez.

Kullanım (Beyin klasöründe): python3 motor/guncelle.py [kontrol | kur [--paket arsiv.tar.gz] | geri]
"""
import hashlib
import json
import os
import shutil
import sys
import tarfile
import tempfile
import time
import urllib.request

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROGRAM = 'program.json'
GUN = 24 * 3600
EN_BUYUK = 60 * 1024 * 1024
YEDEK_SAYI = 5
# Program listesi bunlara asla uzanamaz: kullanıcının verisi ve alttaki hafıza katmanının (hafıza) dosyaları
KORUNAN = ('notlar/', 'sayfalar/', 'ben/', 'knowledge/', 'ham/', 'receipts/', 'daily/', '.durum/', '.git/', '.claude/',
           '.codex/', '.agents/skills/beyin/', '.agents/skills/beyin-doktor/', '.agents/skills/beyin-guncelle/', 'panolar/_blob/')
KORUNAN_DOSYA = ('calisma.json', 'panolar/canvas.json', 'beyin.py', 'AGENTS.md', 'CLAUDE.md', '.beyin-version')


def _durum(kok):
    return os.path.join(kok, '.durum', 'guncelleme')


def sha(yol):
    h = hashlib.sha256()
    with open(yol, 'rb') as f:
        for parca in iter(lambda: f.read(1 << 16), b''):
            h.update(parca)
    return h.hexdigest()


def program_oku(kok=KOK):
    try:
        with open(os.path.join(kok, PROGRAM), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def surum_sayi(s):
    try:
        return tuple(int(x) for x in str(s).lstrip('v').split('-')[0].split('.'))
    except ValueError:
        return (0,)


def yol_gecerli(yol):
    """Listedeki yol göreli, kökün içinde ve korunan alanın dışında olmalı; panolar/ altında yalnız program stilleri."""
    if not yol or os.path.isabs(yol) or '\\' in yol or any(p in ('', '.', '..') for p in yol.split('/')):
        return False
    if yol in KORUNAN_DOSYA or any(yol.startswith(k) for k in KORUNAN):
        return False
    return not yol.startswith('panolar/') or yol.endswith('.css')


def _istek(adres, kabul='application/vnd.github+json', sure=10):
    return urllib.request.urlopen(urllib.request.Request(adres, headers={'Accept': kabul, 'User-Agent': 'beyin-guncelle'}), timeout=sure)


def son_surum(depo):
    """GitHub'daki son yayın: sürüm, notlar, sayfa ve arşiv adresi. Yalnız sürüm bilgisi okunur."""
    with _istek(f'https://api.github.com/repos/{depo}/releases/latest') as r:
        v = json.load(r)
    return {'son': v['tag_name'].lstrip('v'), 'notlar': (v.get('body') or '')[:3000], 'adres': v.get('html_url', ''),
            'arsiv': v['tarball_url']}


def kontrol(kok=KOK, zorla=False):
    """Yeni sürüm var mı. Sonuç günde bir kez sorulur ve .durum/guncelleme/surum.json'da saklanır; zorla hemen sorar."""
    p = program_oku(kok)
    on = os.path.join(_durum(kok), 'surum.json')
    try:
        with open(on, encoding='utf-8') as f:
            eski = json.load(f)
    except (OSError, ValueError):
        eski = {}
    if not zorla and eski.get('surum') == p.get('surum') and time.time() - eski.get('zaman', 0) < GUN:
        return eski
    sonuc = {'surum': p.get('surum', ''), 'depo': p.get('depo', ''), 'zaman': time.time()}
    if not p.get('depo'):
        sonuc.update(durum='bilinmiyor', hata='program.json yok ya da depo yazmıyor')
    else:
        try:
            sonuc.update(son_surum(p['depo']))
            yeni = surum_sayi(sonuc['son']) > surum_sayi(p.get('surum'))
            sonuc['durum'] = 'var' if yeni else 'guncel'
        except Exception as e:  # ağ yok, GitHub cevap vermedi, depo henüz yayın yapmadı
            sonuc.update(durum='bilinmiyor', hata=str(e)[:160])
    os.makedirs(_durum(kok), exist_ok=True)
    with open(on, 'w', encoding='utf-8') as f:
        json.dump(sonuc, f, ensure_ascii=False, indent=1)
    return sonuc


def _indir(adres, hedef):
    with _istek(adres, '*/*', 60) as r, open(hedef, 'wb') as f:  # tarball ucu octet-stream isteğine 415 döner
        toplam = 0
        for parca in iter(lambda: r.read(1 << 16), b''):
            toplam += len(parca)
            if toplam > EN_BUYUK:
                raise ValueError('paket beklenenden büyük')
            f.write(parca)


def _ac(arsiv, hedef):
    """tar.gz'yi güvenle açar (mutlak yol, .., bağ yok) ve program.json'un bulunduğu kökü döndürür."""
    with tarfile.open(arsiv) as t:
        uyelar = []
        for u in t.getmembers():
            if u.name.startswith('/') or '..' in u.name.split('/') or not (u.isfile() or u.isdir()):
                raise ValueError('pakette güvensiz yol: ' + u.name)
            uyelar.append(u)
        t.extractall(hedef, members=uyelar)
    for dizin, _, dosyalar in os.walk(hedef):
        if PROGRAM in dosyalar:
            return dizin
    raise ValueError('pakette program.json yok')


def _yaz(kaynak, hedef):
    os.makedirs(os.path.dirname(hedef), exist_ok=True)
    gecici = hedef + '.guncelleniyor'
    shutil.copy2(kaynak, gecici)
    os.replace(gecici, hedef)


def _kaynak_degil(kok):
    if os.path.exists(os.path.join(kok, 'araclar', 'yayinla.py')):
        raise RuntimeError('Bu kopya programın kaynağı: güncelleme buradan yayınlanır, kurulmaz')


def kur(kok=KOK, paket=None):
    """Son sürümü kurar. paket verilirse (yerel tar.gz) GitHub'a sorulmaz. Sonuç: durum ve değişen dosyaların listesi."""
    _kaynak_degil(kok)
    eski = program_oku(kok)
    eski_dosya = eski.get('dosyalar', {})
    is_ = tempfile.mkdtemp(prefix='indir-', dir=_hazir(kok))
    try:
        if not paket:
            bilgi = kontrol(kok, zorla=True)
            if bilgi['durum'] == 'bilinmiyor':
                raise RuntimeError('Son sürüm öğrenilemedi: ' + bilgi.get('hata', ''))
            if bilgi['durum'] == 'guncel':
                return {'durum': 'guncel', 'surum': eski.get('surum', '')}
            paket = os.path.join(is_, 'paket.tar.gz')
            _indir(bilgi['arsiv'], paket)
        kaynak = _ac(paket, os.path.join(is_, 'ac'))
        with open(os.path.join(kaynak, PROGRAM), encoding='utf-8') as f:
            yeni = json.load(f)
        dosyalar = yeni.get('dosyalar', {})
        kotu = [y for y in dosyalar if not yol_gecerli(y)]
        if kotu:
            raise ValueError('paket korunan yere yazmak istiyor: ' + ', '.join(kotu[:3]))
        for y, h in dosyalar.items():
            if not os.path.isfile(os.path.join(kaynak, y)) or sha(os.path.join(kaynak, y)) != h:
                raise ValueError('paket bozuk: ' + y)
        plan = _planla(kok, eski_dosya, dosyalar)
        if not any(plan[k] for k in ('eklenen', 'degisen', 'silinen')) and yeni.get('surum') == eski.get('surum'):
            return {'durum': 'guncel', 'surum': eski.get('surum', '')}
        yedek = _yedekle(kok, eski, yeni, plan)
        try:
            for y in plan['eklenen'] + plan['degisen']:
                _yaz(os.path.join(kaynak, y), os.path.join(kok, y))
            for y in plan['silinen']:
                os.remove(os.path.join(kok, y))
            _yaz(os.path.join(kaynak, PROGRAM), os.path.join(kok, PROGRAM))
        except OSError:
            _geri_yukle(kok, yedek)
            raise
        hafiza = hafiza_kur(kok) if any(y.startswith('hafiza/') for y in plan['eklenen'] + plan['degisen']) else ''
        kontrol(kok, zorla=False)
        return {'durum': 'guncellendi', 'onceki': eski.get('surum', ''), 'surum': yeni.get('surum', ''),
                'yedek': os.path.relpath(yedek, kok), 'hafiza': hafiza, **plan}
    finally:
        shutil.rmtree(is_, ignore_errors=True)


def hafiza_kur(kok=KOK):
    """Hafıza katmanı (hafiza/ paketi) değiştiyse kurucusu yeniden koşar: kendi dosyalarını yükseltir, notlara dokunmaz.
    Başarısızsa program güncellemesi geri alınmaz; eski hafıza katmanı çalışmayı sürdürür, hata söylenir."""
    import subprocess
    kurucu = os.path.join(kok, 'hafiza', 'scripts', 'install_v3.py')
    if not os.path.isfile(kurucu):
        return ''
    # Hafızanın kendi "Beyni Güncelle" kısayolu kurulmaz: güncelleme tek yoldan, uygulamanın içinden (ya da bu betikle)
    c = subprocess.run([sys.executable, kurucu, '--vault', kok, '--exclude-component', 'launchers'], cwd=kok, capture_output=True,
                       text=True, timeout=300)
    return 'kuruldu' if c.returncode == 0 else 'hata: ' + (c.stderr or c.stdout).strip()[-200:]


def _hazir(kok):
    os.makedirs(_durum(kok), exist_ok=True)
    return _durum(kok)


def _planla(kok, eski, yeni):
    """Elle değişmemiş dosya yenisiyle değişir; değişmişse yine yenisi gelir ama eski hâli çakışma olarak bildirilir.
    Yeni sürümde olmayan dosya, elle değişmemişse silinir; değişmişse yerinde bırakılır."""
    plan = {'eklenen': [], 'degisen': [], 'silinen': [], 'cakisma': [], 'birakilan': []}
    for y, h in sorted(yeni.items()):
        yerel = os.path.join(kok, y)
        if not os.path.isfile(yerel):
            plan['eklenen'].append(y)
            continue
        yh = sha(yerel)
        if yh == h:
            continue
        plan['degisen'].append(y)
        if y in eski and yh != eski[y]:
            plan['cakisma'].append(y)
    for y, h in sorted(eski.items()):
        yerel = os.path.join(kok, y)
        if y in yeni or not os.path.isfile(yerel) or not yol_gecerli(y):
            continue
        (plan['silinen'] if sha(yerel) == h else plan['birakilan']).append(y)
    return plan


def _yedekle(kok, eski, yeni, plan):
    yedek = os.path.join(_hazir(kok), f"yedek-{eski.get('surum') or 'ilk'}-{time.strftime('%Y%m%d-%H%M%S')}")
    for y in plan['degisen'] + plan['silinen'] + ([PROGRAM] if os.path.isfile(os.path.join(kok, PROGRAM)) else []):
        hedef = os.path.join(yedek, 'dosyalar', y)
        os.makedirs(os.path.dirname(hedef), exist_ok=True)
        shutil.copy2(os.path.join(kok, y), hedef)
    os.makedirs(yedek, exist_ok=True)
    with open(os.path.join(yedek, 'geri.json'), 'w', encoding='utf-8') as f:
        json.dump({'onceki': eski.get('surum', ''), 'surum': yeni.get('surum', ''), 'zaman': time.time(), **plan}, f, ensure_ascii=False, indent=1)
    # Son YEDEK_SAYI güncellemenin yedeği kalır; daha eskileri silinir (klasör her sürümde büyümesin)
    eskiler = sorted((os.path.getmtime(os.path.join(_durum(kok), d)), d) for d in os.listdir(_durum(kok)) if d.startswith(('yedek-', 'geri-alindi-')))
    for _, d in eskiler[:-YEDEK_SAYI]:
        shutil.rmtree(os.path.join(_durum(kok), d), ignore_errors=True)
    return yedek


def _geri_yukle(kok, yedek):
    with open(os.path.join(yedek, 'geri.json'), encoding='utf-8') as f:
        kayit = json.load(f)
    for y in kayit['eklenen']:
        if os.path.isfile(os.path.join(kok, y)):
            os.remove(os.path.join(kok, y))
    dosyalar = os.path.join(yedek, 'dosyalar')
    for dizin, _, adlar in os.walk(dosyalar):
        for ad in adlar:
            yol = os.path.join(dizin, ad)
            _yaz(yol, os.path.join(kok, os.path.relpath(yol, dosyalar)))
    return kayit


def son_is(kok=KOK, gun=14):
    """Son güncellemenin kaydı (geri alınmadıysa ve yakınsa): Ayarlar'da çakışan dosyaları ve Geri al'ı göstermek için."""
    d = _durum(kok)
    adaylar = sorted(x for x in os.listdir(d) if x.startswith('yedek-')) if os.path.isdir(d) else []
    for ad in reversed(adaylar):
        try:
            with open(os.path.join(d, ad, 'geri.json'), encoding='utf-8') as f:
                kayit = json.load(f)
        except (OSError, ValueError):
            continue
        if time.time() - kayit.get('zaman', 0) > gun * GUN:
            return None
        return {'onceki': kayit['onceki'], 'surum': kayit['surum'], 'zaman': kayit['zaman'], 'cakisma': kayit['cakisma'],
                'yedek': os.path.relpath(os.path.join(d, ad, 'dosyalar'), kok)}
    return None


def geri(kok=KOK):
    """Son güncellemeyi geri alır: eklenen dosyalar kalkar, değişen ve silinen dosyalar yedekten döner."""
    _kaynak_degil(kok)
    adaylar = sorted(d for d in os.listdir(_hazir(kok)) if d.startswith('yedek-') and os.path.isfile(os.path.join(_durum(kok), d, 'geri.json')))
    if not adaylar:
        raise RuntimeError('geri alınacak güncelleme yok')
    yedek = os.path.join(_durum(kok), adaylar[-1])
    kayit = _geri_yukle(kok, yedek)
    os.rename(yedek, yedek.replace('yedek-', 'geri-alindi-', 1))
    hafiza = hafiza_kur(kok) if any(y.startswith('hafiza/') for y in kayit['eklenen'] + kayit['degisen'] + kayit['silinen']) else ''
    kontrol(kok, zorla=False)
    return {'durum': 'geri_alindi', 'surum': kayit['onceki'], 'onceki': kayit['surum'], 'hafiza': hafiza}


if __name__ == '__main__':
    komut = sys.argv[1] if len(sys.argv) > 1 else 'kontrol'
    try:
        if komut == 'kontrol':
            s = kontrol(zorla=True)
            print({'var': f"Yeni sürüm var: {s['surum']} -> {s['son']}. Kurmak için: python3 motor/guncelle.py kur",
                   'guncel': f"Beyin güncel: {s['surum']}"}.get(s['durum'], 'Sürüm öğrenilemedi: ' + s.get('hata', '')))
        elif komut == 'kur':
            s = kur(paket=sys.argv[sys.argv.index('--paket') + 1] if '--paket' in sys.argv else None)
            if s['durum'] == 'guncel':
                print('Beyin zaten güncel: ' + s['surum'])
            else:
                print(f"Güncellendi: {s['onceki']} -> {s['surum']} · {len(s['eklenen'])} yeni, {len(s['degisen'])} değişen, "
                      f"{len(s['silinen'])} silinen dosya. Yedek: {s['yedek']}")
                for y in s['cakisma']:
                    print('  Senin değiştirdiğin dosya yenisiyle değişti, eski hâli yedekte: ' + y)
                if s['hafiza']:
                    print('Hafıza katmanı: ' + s['hafiza'])
                print('Açıksa Beyin\'i yeniden başlat (Ayarlar › Program › Sunucuyu yeniden başlat).')
        elif komut == 'geri':
            s = geri()
            print(f"Geri alındı: {s['onceki']} -> {s['surum']}")
        else:
            print(__doc__.strip().splitlines()[-1])
            sys.exit(2)
    except Exception as e:
        print('Olmadı: ' + str(e))
        sys.exit(1)
