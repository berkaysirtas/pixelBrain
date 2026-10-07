# Canlı çizim sınaması (K-077): python3 araclar/pano-akis-sinama.py. Sunucu ve Codex gerekmez; geçici bir kasada
# motor/sunucu.py'nin pano akışı işlevlerine Codex'in bildirimleri elle verilir. Bakılanlar: blok açılınca pano tuvale konur,
# içerik parça parça ve eksiksiz yayınlanır (kapanış etiketi sızmaz), blok kapanınca dosya sarılıp yazılır; var olan pano
# yerinde güncellenir ve sürümü saklanır; geçersiz ad, Beyin'den gitmemiş tur ve başka sayfanın panosu korunur.
import json
import os
import shutil
import sys
import tempfile

KASA = tempfile.mkdtemp(prefix='beyin-akis-')
PANOLAR = os.path.join(KASA, 'panolar')
os.makedirs(PANOLAR)
os.environ.update(BEYIN_PANOLAR=PANOLAR, BEYIN_KOK=KASA, BEYIN_DURUM=os.path.join(KASA, '.tuval'))
with open(os.path.join(KASA, 'calisma.json'), 'w', encoding='utf-8') as f:
    json.dump({'calisma_alanlari': [{'id': 'ca', 'ad': 'Deneme', 'alanlar': [{'id': 'akis-alan', 'ad': 'Akış alanı', 'sayfa': 'page-akis'}]}]}, f)
with open(os.path.join(PANOLAR, 'canvas.json'), 'w', encoding='utf-8') as f:
    json.dump({'pages': [{'id': 'page-akis', 'title': 'Akış'}, {'id': 'page-baska', 'title': 'Başka'}], 'order': ['Baska.dc.html'],
               'boards': {'Baska.dc.html': {'page': 'page-baska', 'title': 'Başkasının', 'x': 0, 'y': 0, 'w': 1440, 'h': 900}}}, f)
with open(os.path.join(PANOLAR, 'Baska.dc.html'), 'w', encoding='utf-8') as f:
    f.write('BAŞKA ALANIN PANOSU')
with open(os.path.join(PANOLAR, 'tema.css'), 'w', encoding='utf-8') as f:
    f.write(':root{\n --zemin:#EAE7DE;--yazi:#1A1A1C;--kart:#FFFFFF;\n}\n.kabuk{--zemin:#FFFFFF}\n')
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'motor'))
import sunucu  # noqa: E402

olaylar, sonuc, hatalar = [], {}, []
sunucu.PANO_BOY_DENETIMI = False  # boy denetimi tarayıcı açar ve canlı sunucuya bakar; burada kapalı
sunucu.KOPRU._olay = lambda m: olaylar.append(m['params'])  # yayın köprüye gitmez, burada birikir
sunucu.KOPRU.gorevler['akis-alan'] = {'thread': 't1'}
oku = lambda ad: open(os.path.join(PANOLAR, ad), encoding='utf-8').read()
pano = lambda ad: sunucu.canvas_oku()['boards'].get(ad)
GOVDE = '<helmet><style>.a{color:var(--yazi)}</style></helmet>\n<div style="width: 1200px; height: 800px"><h1>Başlık</h1><p>İçerik</p></div>\n'


def akit(kimlik, metin, boy=7, bitir=True, thread='t1'):
    """Mesajı küçük parçalarla verir; aradaki durumu görmek için parça başına çağrılabilir."""
    for i in range(0, len(metin), boy):
        sunucu._pano_isle({'method': 'item/agentMessage/delta', 'params': {'threadId': thread, 'itemId': kimlik, 'delta': metin[i:i + boy]}})
    if bitir:
        sunucu._pano_isle({'method': 'item/completed', 'params': {'threadId': thread, 'item': {'id': kimlik, 'type': 'agentMessage', 'text': metin}}})


def bak(ad, beklenen, gercek):
    sonuc[ad] = gercek
    if gercek != beklenen:
        hatalar.append(ad)
        sonuc[ad + '_beklenen'] = beklenen


try:
    # 1. Yeni pano: blok açılınca tuvalde (hızlı eylemin yerinde), içerik eksiksiz akar, kapanınca dosya sarılır
    sunucu.PANO_BAGLAM['akis-alan'] = {'sayfa': 'page-akis', 'yer': {'x': 2020, 'y': 0}}
    bas = 'Çiziyorum.\n<pano-yaz ad="Deneme.dc.html" baslik="Deneme panosu" w="1200" h="800">\n'
    akit('m1', bas + GOVDE[:60], bitir=False)
    ara = {'tuvalde': bool(pano('Deneme.dc.html')), 'yer': [pano('Deneme.dc.html')['x'], pano('Deneme.dc.html')['y']] if pano('Deneme.dc.html') else None,
           'yer_tutucu': 'İçerik' not in oku('Deneme.dc.html'), 'surende': 'Deneme.dc.html' in sunucu.PANO_AKIS, 'basladi': bool(olaylar and olaylar[0].get('basla'))}
    olaylar.clear(); sunucu._pano_durum.clear(); sunucu.PANO_AKIS.clear()
    os.remove(os.path.join(PANOLAR, 'Deneme.dc.html'))
    c = sunucu.canvas_oku(); c['boards'].pop('Deneme.dc.html'); c['order'].remove('Deneme.dc.html'); sunucu.canvas_yaz(c)
    sunucu.PANO_BAGLAM['akis-alan'] = {'sayfa': 'page-akis', 'yer': {'x': 2020, 'y': 0}}
    akit('m1', bas + GOVDE + '</pano-yaz>\nÜç sütunlu panoyu çizdim.')
    akan = ''.join(o.get('parca', '') for o in olaylar)
    b = pano('Deneme.dc.html')
    bak('yeni_pano', {'ara': {'tuvalde': True, 'yer': [2020, 0], 'yer_tutucu': True, 'surende': True, 'basladi': True},
                      'akan_tam': True, 'sizinti_yok': True, 'sirali': True, 'bitti': True, 'baslik': 'Deneme panosu', 'boy': [1200, 800], 'yer': [2020, 0],
                      'dosya': True, 'tema': True, 'iskelet': True, 'suren_kalmadi': True},
        {'ara': ara, 'akan_tam': akan == GOVDE, 'sizinti_yok': '</pano' not in akan and 'çizdim' not in akan,
         'sirali': all(o['bas'] == sum(len(x.get('parca', '')) for x in olaylar[:i]) for i, o in enumerate(olaylar)),
         'bitti': bool(olaylar[-1].get('bitti')) and not olaylar[-1].get('yarim'), 'baslik': b['title'], 'boy': [b['w'], b['h']], 'yer': [b['x'], b['y']],
         'dosya': '<h1>Başlık</h1>' in oku('Deneme.dc.html'), 'tema': '<helmet><link rel="stylesheet" href="./tema.css"><link rel="stylesheet" href="./pano-kit.css"><style>' in oku('Deneme.dc.html'),
         'iskelet': oku('Deneme.dc.html').startswith('<!doctype html>') and '"$preview":{"width":1200,"height":800}' in oku('Deneme.dc.html'),
         'suren_kalmadi': not sunucu.PANO_AKIS})

    # 2. Var olan pano: aynı adla yeni blok yerinde günceller (x, y sayılmaz), önceki sürüm saklanır
    olaylar.clear()
    akit('m2', '<pano-yaz ad="Deneme.dc.html" baslik="Yeni başlık" w="1200" h="1000" x="5" y="5">\n<div style="width: 1200px; height: 1000px">İKİNCİ</div>\n</pano-yaz>', boy=11)
    b = pano('Deneme.dc.html')
    surumler = os.listdir(os.path.join(sunucu.DURUM, 'pano-surum')) if os.path.isdir(os.path.join(sunucu.DURUM, 'pano-surum')) else []
    bak('guncelleme', {'yer': [2020, 0], 'baslik': 'Yeni başlık', 'boy': [1200, 1000], 'dosya': True, 'surum': True, 'helmet_eklendi': True},
        {'yer': [b['x'], b['y']], 'baslik': b['title'], 'boy': [b['w'], b['h']], 'dosya': 'İKİNCİ' in oku('Deneme.dc.html') and 'Başlık' not in oku('Deneme.dc.html'),
         'surum': any(s.startswith('Deneme-') for s in surumler), 'helmet_eklendi': '<helmet><link rel="stylesheet" href="./tema.css"><link rel="stylesheet" href="./pano-kit.css"></helmet>' in oku('Deneme.dc.html')})

    # 3. Geçersiz ad ve Beyin'den gönderilmemiş tur: dosya yok, yayın yok
    olaylar.clear()
    akit('m3', '<pano-yaz ad="../kacak.dc.html" baslik="x">\n<div>x</div>\n</pano-yaz>')
    akit('m4', '<pano-yaz ad="Duz.html" baslik="x">\n<div>x</div>\n</pano-yaz>')
    akit('m5', '<pano-yaz ad="Yabanci.dc.html" baslik="x">\n<div>x</div>\n</pano-yaz>', thread='baska-thread')
    bak('gecersiz', {'olay': 0, 'dosya': False}, {'olay': len(olaylar), 'dosya': any(os.path.exists(os.path.join(d, a)) for d in (PANOLAR, KASA) for a in ('kacak.dc.html', 'Duz.html', 'Yabanci.dc.html'))})

    # 4. Kapanmadan biten mesaj: eldeki içerik yazılır ve yarım diye işaretlenir
    olaylar.clear()
    akit('m6', '<pano-yaz ad="Yarim.dc.html" baslik="Yarım" w="800" h="600">\n<div style="width: 800px; height: 600px"><h2>Bitmedi')
    bak('yarim', {'dosya': True, 'yarim': True}, {'dosya': '<h2>Bitmedi' in oku('Yarim.dc.html'), 'yarim': bool(olaylar[-1].get('yarim'))})

    # 5. Başka sayfanın panosuyla aynı ad: üstüne yazılmaz, yeni ad alır
    olaylar.clear()
    akit('m7', '<pano-yaz ad="Baska.dc.html" baslik="Benim">\n<div>BENİM</div>\n</pano-yaz>')
    bak('baska_sayfa', {'eski_duruyor': True, 'yeni_ad': 'Baska2.dc.html', 'yeni_sayfa': 'page-akis'},
        {'eski_duruyor': oku('Baska.dc.html') == 'BAŞKA ALANIN PANOSU', 'yeni_ad': olaylar[0].get('ad'), 'yeni_sayfa': (pano('Baska2.dc.html') or {}).get('page')})

    # 6. Parçasız gelen mesaj (yalnız tamamlandı bildirimi), tam belge ve kod çiti
    olaylar.clear()
    tam = '<!doctype html>\n<html lang="tr"><head><title>Tam</title></head><body><x-dc><div>TAM</div></x-dc></body></html>'
    sunucu._pano_isle({'method': 'item/completed', 'params': {'threadId': 't1', 'item': {'id': 'm8', 'type': 'agentMessage', 'text': f'<pano-yaz ad="Tam.dc.html" baslik="Tam">\n```html\n{tam}\n```\n</pano-yaz>'}}})
    bak('tam_belge', {'oldugu_gibi': True, 'olay': 3}, {'oldugu_gibi': oku('Tam.dc.html').strip() == tam, 'olay': len(olaylar)})

    # 7. Tarif: sayfa, konum ve renk adları tarifte; eski curl yolu yalnız etkileşimli pano için
    tarif = sunucu.yerlestir_tarifi('page-akis', 2020, 0)
    # Kit (K-078): tarifteki her sınıf pano-kit.css'te tanımlı olmalı; yoksa Codex işe yaramayan sınıf yazar
    kit = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'panolar', 'pano-kit.css'), encoding='utf-8').read()
    import re as _re
    siniflar = set(_re.findall(r'\.(pk-[a-z]+|s[245]|vurgu)\b', tarif))
    renkler = ['mavi', 'yesil', 'sari', 'kirmizi', 'mor', 'turuncu', 'gri', 'pembe']
    eksik = sorted(k for k in siniflar | set(renkler) if '.' + k not in kit)
    bak('tarif', {'blok': True, 'konum': True, 'renk': True, 'sayfa': True, 'kit_kok': True, 'stil_yazma': True, 'eksik_sinif': []},
        {'blok': '<pano-yaz ad="<Ad>.dc.html"' in tarif, 'konum': 'x="2020" y="0"' in tarif, 'renk': '--zemin, --yazi, --kart' in tarif, 'sayfa': "'page-akis'" in tarif,
         'kit_kok': '<div class="pk">' in tarif, 'stil_yazma': 'Stil yazma' in tarif, 'eksik_sinif': eksik})
finally:
    shutil.rmtree(KASA, ignore_errors=True)
print(json.dumps({'sonuc': sonuc, 'hatalar': hatalar}, ensure_ascii=False, indent=1))
sys.exit(1 if hatalar else 0)
