"""Hafıza: hafıza katmanı (bu klasörde kurulu V3) ile Beyin arasındaki ince katman.

Alt kat hafıza katmanının: kimlik klasörü ben/ (Core, Kurallar, Last-Session, Threads, Journal), knowledge/, receipt'ler,
yerel indeks ve `beyin.py context` araması. Beyin bunu okur ve her mesajda Codex'e verir; kendi araması yok.
- Öğrenilen tercih: knowledge/tercihler/*.md, `kind: preference`, `validity: current | rejected`. Reddedilen bağlama girmez.
- İzolasyon: .beyin-projects.json çalışma alanlarının klasörlerini projeye bağlar. Her not ortak beyne girer; izole
  çalışma alanında arama `--project` ile yalnız o alanın kaynaklarından yapılır, kimliğin süreklilik dosyaları gitmez.
Kod sayar ve süzer, model yorumlar: bağlamı seçen hafızanın yerel araması, Codex yalnız okur.
"""
import json
import os
import re
import subprocess
import sys
from datetime import date

BEN = {'core': 'Core.md', 'kurallar': 'Kurallar.md'}
TERCIH = os.path.join('knowledge', 'tercihler')
PROJELER = '.beyin-projects.json'
BEN_SINIRI = 9000       # <kullanici> bloğu, karakter (hafıza Codex için 9.500 kullanıyor)
NOT_SINIRI = 6000       # <ilgili_notlar> bütçesi, karakter
KISA = re.compile(r'[^a-z0-9]+')
TR = str.maketrans('çğıöşüâîû', 'cgiosuaiu')


def _oku(yol):
    try:
        with open(yol, encoding='utf-8') as f:
            return f.read()
    except OSError:
        return ''


def _yaz(yol, metin):
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    gecici = yol + '.yaziliyor'
    with open(gecici, 'w', encoding='utf-8') as f:
        f.write(metin)
    os.replace(gecici, yol)


def _on_bilgi(metin):
    alanlar, govde = {}, metin
    if metin.startswith('---\n'):
        bas, _, govde = metin[4:].partition('\n---')
        for satir in bas.splitlines():
            k, ayrac, v = satir.partition(':')
            if ayrac and k.strip():
                alanlar[k.strip()] = v.strip()
    return alanlar, govde.lstrip('-\n').strip()


def _on_bilgi_yaz(alanlar, govde):
    return '---\n' + ''.join(f'{k}: {v}\n' for k, v in alanlar.items() if v not in (None, '')) + '---\n' + govde.strip() + '\n'


def _govde(metin):
    """Ön bilgi ve ilk başlık satırından sonrası."""
    govde = _on_bilgi(metin)[1]
    return govde.partition('\n')[2].strip() if govde.startswith('# ') else govde


# Tercihler: Codex konuşmadan çıkarır, sen reddedebilirsin
def tercihler(kok):
    klasor = os.path.join(kok, TERCIH)
    sonuc = []
    for ad in sorted(os.listdir(klasor)) if os.path.isdir(klasor) else []:
        if not ad.endswith('.md'):
            continue
        alanlar, govde = _on_bilgi(_oku(os.path.join(klasor, ad)))
        sonuc.append({'id': alanlar.get('id') or ad[:-3], 'dosya': ad, 'metin': govde, 'tarih': alanlar.get('created_at', ''),
                      'gecerli': alanlar.get('validity', 'current') != 'rejected', 'neden': alanlar.get('rejected_reason', '')})
    return sonuc


def _tercih_bul(kok, kimlik):
    for t in tercihler(kok):
        if t['id'] == kimlik:
            return os.path.join(kok, TERCIH, t['dosya'])
    raise ValueError('Tercih bulunamadı')


def tercih_ekle(kok, metin, tarih=None):
    """Yeni tercih kaydı (geçiş için; Codex kendisi beyin.py note-create ile yazar)."""
    kisa = KISA.sub('-', metin.lower().translate(TR)).strip('-')[:40].strip('-') or 'tercih'
    kimlik = 'tercih-' + kisa
    _yaz(os.path.join(kok, TERCIH, kisa + '.md'), _on_bilgi_yaz(
        {'id': kimlik, 'kind': 'preference', 'validity': 'current', 'visibility': 'internal', 'created_at': tarih or date.today().isoformat()}, metin))
    return kimlik


def ben_oku(kok):
    t = tercihler(kok)
    return {'core': _govde(_oku(os.path.join(kok, 'ben', BEN['core']))), 'kurallar': _govde(_oku(os.path.join(kok, 'ben', BEN['kurallar']))),
            'ogrenilen': [x for x in t if x['gecerli']], 'reddedilen': [x for x in t if not x['gecerli']]}


def ben_yaz(kok, istek):
    """Senin iki dosyan (core, kurallar) ya da bir tercihi reddetme / geri alma (hafıza validity alanıyla)."""
    if istek.get('reddet') or istek.get('geriAl'):
        yol = _tercih_bul(kok, istek.get('reddet') or istek.get('geriAl'))
        alanlar, govde = _on_bilgi(_oku(yol))
        if istek.get('reddet'):
            alanlar.update({'validity': 'rejected', 'rejected_reason': str(istek.get('neden') or 'Kullanıcı reddetti').replace('\n', ' ')[:200],
                            'rejected_at': date.today().isoformat()})
        else:
            alanlar['validity'] = 'current'
            alanlar.pop('rejected_reason', None)
            alanlar.pop('rejected_at', None)
        _yaz(yol, _on_bilgi_yaz(alanlar, govde))
        return ben_oku(kok)
    ad = istek['ad']
    if ad not in BEN:
        raise ValueError('Bu dosya yazılamaz')
    baslik = {'core': '# Ben', 'kurallar': '# Kurallar'}[ad]
    _yaz(os.path.join(kok, 'ben', BEN[ad]), baslik + '\n\n' + str(istek.get('metin') or '').strip() + '\n')
    return ben_oku(kok)


def _bolumler(metin):
    return [('## ' + p).strip() for p in re.split(r'(?m)^## ', _govde(metin))[1:]]


def ben_baglami(kok, izole=False):
    """Her mesajda Codex'e giden <kullanici> bloğu. Kurallar önce gelir. İzole çalışma alanında yalnız kimlik
    (Core, Kurallar, tercihler) gider; Last-Session, Threads ve Journal başka işleri taşıdığı için gitmez."""
    b = ben_oku(kok)
    parcalar = [('Kurallar', b['kurallar']), ('Kendi yazdıkları (Core)', b['core']),
                ('Öğrenilen tercihler', '\n'.join('- ' + t['metin'] for t in b['ogrenilen']))]
    if not izole:
        son = lambda ad: _bolumler(_oku(os.path.join(kok, 'ben', ad)))
        parcalar += [('Nerede kaldık (Last-Session, son kart)', (son('Last-Session.md') or [''])[0]),
                     ('Açık konular (Threads)', _govde(_oku(os.path.join(kok, 'ben', 'Threads.md')))[:3000]),
                     ('Son günlük (Journal)', (son('Journal.md') or [''])[-1][:1200])]
    govde = '\n\n'.join(f'## {ad}\n{metin}' for ad, metin in parcalar if metin)
    if not govde:
        return None
    return '<kullanici>\nKullanıcıyı tanı: bu blok hafızanın kimlik klasöründen (ben/) her mesajda gelir.\n\n' + govde[:BEN_SINIRI] + '\n</kullanici>'


# İlgili kayıtlar: hafızanın yerel araması
def notlar_baglami(kok, sorgu, proje=None, haric=(), haric_proje=(), atla=()):
    """beyin.py context ile kaynak bağlantılı kayıtlar. proje verilirse yalnız o çalışma alanı; haric klasörleri (gizli program
    alanı) projesiz aramadan süzülür; atla: bu konuşmada yakın zamanda gitmiş kaynaklar, tekrar gönderilmez. Hata olursa susar."""
    komut = [sys.executable, os.path.join(kok, 'beyin.py'), 'context', sorgu[:2000], '--audience', 'internal', '--harness', 'codex',
             '--limit', '8' if haric else '5', '--budget-chars', str(NOT_SINIRI)] + (['--project', proje] if proje else [])
    try:
        cikti = subprocess.run(komut, cwd=kok, capture_output=True, text=True, timeout=30)
        veri = json.loads(cikti.stdout) if cikti.returncode == 0 else {}
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None
    # Kimlik ve tercihler zaten <kullanici> bloğunda: aynı metin iki kez gitmesin
    kayitlar = [k for k in veri.get('records') or [] if not str(k.get('source', '')).startswith(('ben/', TERCIH + '/', *haric))
                and k.get('project') not in haric_proje and k.get('source') not in atla][:5]
    if not kayitlar:
        return None
    satirlar = ['<ilgili_notlar>', 'hafızanın yerel aramasının bu mesajla eşleştirdiği kayıtlar' + (f" (yalnız '{proje}' çalışma alanı)" if proje else '')
                + '. Geçmiş kararları buradan hatırla, kaynağıyla an; gerekirse dosyayı kendin oku.']
    for k in kayitlar:
        metin = re.sub(r'\s+', ' ', k.get('text', '')).strip()
        satirlar.append(f"\n- {k.get('source')}" + (' (kırpıldı)' if k.get('text_truncated') else '') + f'\n  {metin}')
    return '\n'.join(satirlar) + '\n</ilgili_notlar>'


def projeleri_yaz(kok, calisma):
    """Çalışma alanlarını hafıza projelerine bağlar: notlar/<alan>, sayfalar/<alan> ve ham/kaynaklar/<çalışma alanı> o projeye.
    Yalnız var olan klasörler yazılır (hafıza olmayan klasörü reddeder). Projesiz kayıt projeli aramaya girmez."""
    klasorler = {}
    for ca in calisma.get('calisma_alanlari', []):
        for a in ca.get('alanlar', []):
            klasorler['notlar/' + a['id']] = ca['id']
            klasorler['sayfalar/' + a['id']] = ca['id']  # konu notları (K-024)
        klasorler['ham/kaynaklar/' + ca['id']] = ca['id']
    klasorler = {k: v for k, v in sorted(klasorler.items()) if os.path.isdir(os.path.join(kok, k))}
    _yaz(os.path.join(kok, PROJELER), json.dumps({'folders': klasorler, 'shared_unscoped': False}, ensure_ascii=False, indent=1) + '\n')
