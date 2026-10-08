#!/usr/bin/env python3
"""Codex kullanım sınırının sınaması (K-085), ağsız ve modelsiz: python3 araclar/kota-sinama.py

Köprünün Codex'e giden isteği taklit edilir. Denetlenen: kota okuması pencereleri kısadan uzuna dizer, plan ve sıfırlama hakkını
sayar; tur sırasındaki seyrek güncelleme yalnız gelen pencereyi değiştirir, 'premium' sayacı atlanır; tur bitince 5 saatlik
pencereden harcanan yüzde ölçüm kaydına 'kota' olarak girer, pencere arada sıfırlandıysa girmez; arka plan işi (tek_tur) 'arka'
işaretiyle kayda girer ve receipt göndermez; Fast yalnız istenince gider, yoksa tur açıkça standart.
Çıktı tek satır JSON: {"hatalar": [...]}. Hata varsa her biri ayrıca HATA satırı olarak yazılır, çıkış 1.
"""
import json
import os
import shutil
import sys
import tempfile

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'motor'))
from codex import Kopru  # noqa: E402

hatalar = []


def bekle(kosul, ad):
    if not kosul:
        hatalar.append(ad)


BES, HAFTA = 1791476457, 1792063257
OKUMA = {'rateLimits': {'limitId': 'codex', 'planType': 'plus', 'primary': {'usedPercent': 16, 'windowDurationMins': 10080, 'resetsAt': HAFTA},
                        'secondary': {'usedPercent': 40, 'windowDurationMins': 300, 'resetsAt': BES}},
         'rateLimitResetCredits': {'credits': [{'status': 'available'}, {'status': 'available'}, {'status': 'redeemed'}]}}


class Sahte(Kopru):
    """Codex süreci yok: istekler kaydedilir, cevap sözlükten gelir."""
    def __init__(self, kok):
        super().__init__(kok, os.path.join(kok, '.durum'))
        self.giden, self.okuma = [], OKUMA

    def baslat(self):
        pass

    def istek(self, yontem, params, zaman_asimi=120):
        self.giden.append((yontem, params))
        if yontem == 'account/rateLimits/read':
            return json.loads(json.dumps(self.okuma))
        if yontem == 'thread/start':
            return {'thread': {'id': 't-arka'}}
        if yontem == 'turn/start':
            return {'turn': {'id': 'u1'}}
        if yontem == 'account/rateLimitResetCredit/consume':
            return {'outcome': 'reset'}
        return {}


kok = tempfile.mkdtemp(prefix='kota-sinama-')
os.makedirs(os.path.join(kok, '.durum'))
try:
    k = Sahte(kok)
    k.gorev = lambda alan, talimat: 't1'
    k.modeller = lambda: [{'id': 'm', 'varsayilan': True, 'varsayilanEfor': 'low'}]
    ozetler = []
    k.tur_ozeti = ozetler.append

    # 1. Okuma: kısadan uzuna, plan, yalnız kullanılabilir haklar
    o = k.kota_oku()
    bekle([w['dk'] for w in o['pencereler']] == [300, 10080], 'pencereler kısadan uzuna dizilmedi')
    bekle(o['plan'] == 'plus' and o['haklar'] == 2, 'plan ya da hak sayısı yanlış: ' + str((o['plan'], o['haklar'])))
    bekle(k.kota_kisa() == (40, BES), 'kısa pencere yanlış: ' + str(k.kota_kisa()))
    n = len(k.giden)
    k.kota_oku()
    bekle(len(k.giden) == n, 'taze önbellek varken Codex\'e yeniden soruldu')

    # 2. Tur: başlangıç önbellekten, seyrek güncelleme, premium atlanır, fark kayda girer, Fast istenmedi
    k.gonder('alan-a', 'merhaba', 'talimat', model='m', efor='low')
    tur = [p for y, p in k.giden if y == 'turn/start'][-1]
    bekle(tur.get('serviceTierForTurn') == 'default', 'Fast istenmediği hâlde tur standart gitmedi: ' + str(tur.get('serviceTierForTurn')))
    k._olay({'method': 'account/rateLimits/updated', 'params': {'rateLimits': {'limitId': 'premium', 'primary': {'usedPercent': 99, 'windowDurationMins': 300}}}})
    bekle(k.kota_kisa()[0] == 40, 'premium sayacı 5 saatlik pencereyi değiştirdi')
    k._olay({'method': 'account/rateLimits/updated', 'params': {'rateLimits': {'limitId': 'codex', 'primary': {'usedPercent': 52, 'windowDurationMins': 300, 'resetsAt': BES}, 'secondary': None}}})
    bekle([w['yuzde'] for w in k.kota['pencereler']] == [52, 16], 'seyrek güncelleme yanlış birleşti: ' + str(k.kota['pencereler']))
    k._olay({'method': 'turn/completed', 'params': {'threadId': 't1', 'turn': {'status': 'completed'}}})
    kayit = k.olcumler()[-1]
    bekle(kayit.get('kota') == 12 and kayit.get('katman') == 'standart', 'turun harcadığı yanlış: ' + str((kayit.get('kota'), kayit.get('katman'))))
    bekle(len(ozetler) == 1, 'panel turu receipt özeti göndermedi')

    # 3. Fast istenince gider; pencere arada sıfırlanırsa fark yazılmaz
    k.gonder('alan-a', 'çiz', 'talimat', model='m', efor='low', katman='priority')
    bekle([p for y, p in k.giden if y == 'turn/start'][-1].get('serviceTierForTurn') == 'priority', 'Fast istendiği hâlde gitmedi')
    k._olay({'method': 'account/rateLimits/updated', 'params': {'rateLimits': {'limitId': 'codex', 'primary': {'usedPercent': 3, 'windowDurationMins': 300, 'resetsAt': BES + 18000}}}})
    k._olay({'method': 'turn/completed', 'params': {'threadId': 't1', 'turn': {'status': 'completed'}}})
    kayit = k.olcumler()[-1]
    bekle('kota' not in kayit and kayit.get('katman') == 'priority', 'sıfırlanan pencerede fark yazıldı ya da katman yanlış: ' + str(kayit))

    # 4. Arka plan işi: 'arka' işaretiyle kayda girer, receipt yok, standart katman
    k.kota['_t'] = 0  # tek_tur başlangıcı taze okur
    k.okuma = json.loads(json.dumps(OKUMA))
    k.okuma['rateLimits']['secondary']['usedPercent'] = 60
    k.bekle = lambda son, zaman=15: [{'sira': son + 1, 'method': 'turn/completed', 'params': {'threadId': 't-arka'}}]
    import threading
    bitti = threading.Event()
    eski_bas = k._kota_bas
    k._kota_bas = lambda o: (eski_bas(o), bitti.set())
    k.tek_tur('talimat', [], 'metin', {}, ad='arka: yazı önerisi')
    bitti.wait(5)
    bekle([p for y, p in k.giden if y == 'turn/start'][-1].get('serviceTierForTurn') == 'default', 'arka plan işi standart gitmedi')
    k._olay({'method': 'account/rateLimits/updated', 'params': {'rateLimits': {'limitId': 'codex', 'primary': {'usedPercent': 61, 'windowDurationMins': 300, 'resetsAt': BES}}}})
    k._olay({'method': 'turn/completed', 'params': {'threadId': 't-arka', 'turn': {'status': 'completed'}}})
    kayit = k.olcumler()[-1]
    bekle(kayit.get('arka') is True and kayit.get('alan') == 'arka: yazı önerisi' and kayit.get('kota') == 1, 'arka plan işi kayda doğru girmedi: ' + str(kayit))
    bekle(len(ozetler) == 2, 'arka plan işi receipt özeti gönderdi')

    # 5. Sıfırlama hakkı: anahtar gider, önbellek düşer
    bekle(k.kota_sifirla('anahtar-1') == 'reset' and k.kota is None, 'sıfırlama sonucu ya da önbellek yanlış')
    bekle(k.giden[-1] == ('account/rateLimitResetCredit/consume', {'idempotencyKey': 'anahtar-1'}), 'sıfırlama anahtarı gitmedi')
finally:
    shutil.rmtree(kok, ignore_errors=True)

for h in hatalar:
    print('HATA', h)
print(json.dumps({'hatalar': hatalar}, ensure_ascii=False))
sys.exit(1 if hatalar else 0)
