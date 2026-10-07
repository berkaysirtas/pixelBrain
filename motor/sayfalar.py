"""Sayfalar: Notion benzeri serbest notlar. Her sayfa sayfalar/<id>.md, ön bilgi düz (hafıza okur, beyne girer).

- Ön bilgi: id, kind note, title (JSON tırnaklı: iki nokta YAML'ı bozmasın), parent (alt sayfa), created_at, updated_at.
- Gövde Markdown; tarayıcıdaki blok düzenleyici (motor/sayfa.js) aynı biçimi yazar ve okur.
- Silinen sayfa sayfalar/.cop/ altına taşınır: geri alınabilir, hafıza gizli klasörü okumaz.
- Her sayfanın çizim sekmesi tuvalde kendi sayfası: page-sayfa-<id>.
- Konu notu (K-024): alanın notları sayfalar/<alan>/ altında; .beyin-projects.json klasörü o çalışma alanının projesine
  bağlar (izole alanın notu izole kalır). Alanın ana notu `ana: evet`, alan açılınca Yazı sekmesinde o gelir; çizimi
  alanın kendi tuvali.
"""
import json
import os
import re
import secrets
import time

KLASOR = 'sayfalar'
COP = os.path.join(KLASOR, '.cop')
KIMLIK = re.compile(r'^s-[0-9]{14}-[0-9a-f]{4}$')
ALAN = re.compile(r'^[a-z0-9][a-z0-9-]{0,60}$')


def _klasor(kok, alan=''):
    if alan and not ALAN.match(alan):
        raise ValueError('alan geçersiz')
    return os.path.join(kok, KLASOR, alan) if alan else os.path.join(kok, KLASOR)


def _yol(kok, kimlik):
    """Sayfanın dosyası: genel sayfa sayfalar/<id>.md, konu notu sayfalar/<alan>/<id>.md."""
    if not KIMLIK.match(kimlik or ''):
        raise ValueError('sayfa kimliği geçersiz')
    duz = os.path.join(kok, KLASOR, kimlik + '.md')
    if os.path.exists(duz):
        return duz
    kok_klasor = os.path.join(kok, KLASOR)
    for ad in sorted(os.listdir(kok_klasor)) if os.path.isdir(kok_klasor) else []:
        yol = os.path.join(kok_klasor, ad, kimlik + '.md')
        if not ad.startswith('.') and os.path.exists(yol):
            return yol
    return duz


def _ayir(metin):
    alanlar, govde = {}, metin
    if metin.startswith('---\n'):
        bas, _, govde = metin[4:].partition('\n---')
        for satir in bas.splitlines():
            k, ayrac, v = satir.partition(':')
            if ayrac and k.strip():
                v = v.strip()
                if v.startswith('"'):
                    try:
                        v = json.loads(v)
                    except ValueError:
                        pass
                alanlar[k.strip()] = v
    return alanlar, govde.lstrip('-').lstrip('\n')


yazildi = None  # yol -> None; sunucu kendi yazdığı sayfayı Defter kilidinin kopyasına işler (K-066)


def _yaz(yol, alanlar, govde):
    on = ''.join(f'{k}: {json.dumps(v, ensure_ascii=False) if k == "title" else v}\n' for k, v in alanlar.items() if v not in (None, ''))
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    gecici = yol + '.yaziliyor'
    with open(gecici, 'w', encoding='utf-8') as f:
        f.write('---\n' + on + '---\n' + govde.rstrip() + '\n')
    os.replace(gecici, yol)
    if yazildi:
        yazildi(yol)


def _simdi():
    return time.strftime('%Y-%m-%dT%H:%M:%S')


def liste(kok, alan=''):
    """Genel sayfalar (alan boş) ya da bir alanın notları."""
    klasor = _klasor(kok, alan)
    sonuc = []
    for ad in sorted(os.listdir(klasor)) if os.path.isdir(klasor) else []:
        if ad.endswith('.md') and KIMLIK.match(ad[:-3]):
            with open(os.path.join(klasor, ad), encoding='utf-8') as f:
                alanlar, _ = _ayir(f.read())
            sonuc.append({'id': ad[:-3], 'title': alanlar.get('title') or '', 'parent': alanlar.get('parent') or '', 'alan': alan,
                          'ana': alanlar.get('ana') == 'evet', 'bilgi': alanlar.get('bilgi') == 'evet', 'created_at': alanlar.get('created_at', ''), 'updated_at': alanlar.get('updated_at', '')})
    return sorted(sonuc, key=lambda s: s['created_at'])


def hepsi(kok):
    """Bütün sayfalar: ortak (sayfalar/) ve her alanın (sayfalar/<alan>/); kenar çubuğu ağacı için."""
    sonuc = liste(kok)
    kok_klasor = os.path.join(kok, KLASOR)
    for ad in sorted(os.listdir(kok_klasor)) if os.path.isdir(kok_klasor) else []:
        if not ad.startswith('.') and ALAN.match(ad) and os.path.isdir(os.path.join(kok_klasor, ad)):
            sonuc += liste(kok, ad)
    return sonuc


def oku(kok, kimlik):
    with open(_yol(kok, kimlik), encoding='utf-8') as f:
        alanlar, govde = _ayir(f.read())
    return {'id': kimlik, 'title': alanlar.get('title') or '', 'parent': alanlar.get('parent') or '', 'alan': alanlar.get('alan') or '',
            'ana': alanlar.get('ana') == 'evet', 'bilgi': alanlar.get('bilgi') == 'evet', 'govde': govde.rstrip('\n'), 'created_at': alanlar.get('created_at', ''),
            'updated_at': alanlar.get('updated_at', '')}


def yaz(kok, istek):
    """Kimlik yoksa yeni sayfa (parent verilebilir), varsa başlık ve gövde güncellenir."""
    kimlik = istek.get('id')
    if not kimlik:
        kimlik = 's-' + time.strftime('%Y%m%d%H%M%S') + '-' + secrets.token_hex(2)
        parent, alan = istek.get('parent') or '', istek.get('alan') or ''
        if parent:
            alan = oku(kok, parent)['alan']  # alt sayfa üstünün klasöründe durur
        alanlar = {'id': kimlik, 'kind': 'note', 'title': str(istek.get('title') or '').strip(), 'parent': parent, 'alan': alan,
                   'ana': 'evet' if istek.get('ana') else '', 'bilgi': 'evet' if istek.get('bilgi') else '', 'created_at': _simdi(), 'updated_at': _simdi()}
        _yaz(os.path.join(_klasor(kok, alan), kimlik + '.md'), alanlar, str(istek.get('govde') or ''))
        return oku(kok, kimlik)
    yol = _yol(kok, kimlik)
    with open(yol, encoding='utf-8') as f:
        alanlar, govde = _ayir(f.read())
    if 'title' in istek:
        alanlar['title'] = str(istek['title']).replace('\n', ' ').strip()[:200]
    if 'govde' in istek:
        govde = str(istek['govde'])
    alanlar['updated_at'] = _simdi()
    _yaz(yol, alanlar, govde)
    return oku(kok, kimlik)


def sil(kok, istek):
    """Sayfa çöpe (sayfalar/.cop/) gider; alt sayfaları bir üst sayfaya bağlanır."""
    kimlik = istek['id']
    yol = _yol(kok, kimlik)
    with open(yol, encoding='utf-8') as f:
        bilgi = _ayir(f.read())[0]
    if bilgi.get('ana') == 'evet':
        raise ValueError('Alanın ana notu silinmez')
    ust = bilgi.get('parent') or ''
    for s in liste(kok, bilgi.get('alan') or ''):
        if s['parent'] == kimlik:
            alt = _yol(kok, s['id'])
            with open(alt, encoding='utf-8') as f:
                alanlar, govde = _ayir(f.read())
            alanlar['parent'] = ust
            _yaz(alt, alanlar, govde)
    os.makedirs(os.path.join(kok, COP), exist_ok=True)
    os.replace(yol, os.path.join(kok, COP, kimlik + '.md'))
    return {'ust': ust}


def ana_not(kok, alan, ad):
    """Alanın ana notu; yoksa alanın adıyla boş açılır."""
    for s in liste(kok, alan):
        if s['ana']:
            return oku(kok, s['id'])
    return yaz(kok, {'title': ad, 'alan': alan, 'ana': True})


def bilgi_not(kok, alan, ad):
    """Alanın Bilgi sayfası (K-038): Codex'in derlediği özet, kümeler, veri yorumları; yoksa boş açılır. Defter'den ayrıdır."""
    for s in liste(kok, alan):
        if s['bilgi']:
            return oku(kok, s['id'])
    return yaz(kok, {'title': ad + ' · Bilgi', 'alan': alan, 'bilgi': True})


def tuval_sayfasi(kimlik):
    return 'page-sayfa-' + kimlik


def talimat(kok, kimlik):
    s = oku(kok, kimlik)
    return '\n'.join([
        "Sen Beyin adlı yerel, görsel önce ikinci beyin programının Codex'isin. Kullanıcının bir Sayfası (Notion benzeri serbest not) "
        f"üzerinde çalışıyorsun: '{s['title'] or 'Başlıksız'}', dosya {KLASOR}/{kimlik}.md. Türkçe, kısa ve somut yaz; em dash kullanma.",
        "Bu klasör Beyin'in hafızası. Hafıza bu oturumda kısadır (AGENTS.md'deki genel kuralın yerine geçer): geçmiş mesajla gelir, "
        ".agents/skills/beyin/SKILL.md'yi yalnız not ya da görev yazacağın turda oku; arama gerekirse `python3 beyin.py context \"<sorgu>\" "
        "--harness codex --limit 5 --budget-chars 4000 --no-sync`. Receipt gönderme: tur bitince Beyin kendisi gönderir.",
        "Çizim istenince sayfanın içeriğini pano olarak çiz. Panoyu dosyaya yazma: cevabında mesajla gelen <cizim_modu> tarifindeki "
        f"<pano-yaz ad= baslik= w= h=> bloğuyla ver; Beyin akarken tuvale çizer, dosyayı yazar ve '{tuval_sayfasi(kimlik)}' sayfasına koyar. "
        "İzin isteme; repo git'te. Panoyu denetlemek için "
        f"`curl -s 'http://127.0.0.1:{os.environ.get('PORT', '4620')}/api/pano-denetle?ad=<Pano>.dc.html'`; node araclar/pano.mjs sandbox'ta çalışmaz.",
        "Veri yorumu (dosya, tablo, PDF, görsel, link, YouTube videosu) istenince .agents/skills/beyin-veri/SKILL.md'ye uy; ağ açık. "
        "Sayfa kullanıcının yazısı: her mesajda <sayfa> bloğunda son hali gelir. Özetle, eleştir, genişlet; önerini cevapta yaz. "
        "Kullanıcı açıkça 'sayfaya yaz / ekle / düzelt' derse dosyayı düzenle: ön bilgiyi koru, gövde Markdown (başlık, liste, "
        "- [ ] yapılacak, > alıntı, ``` kod); sayfa ekranı tur bitince yenilenir. Geçici JSON'u .durum/ altına yaz.",
    ])
