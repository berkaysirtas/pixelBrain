"""Codex köprüsü: `codex app-server` sürekli açık bir süreç, JSON-RPC (satır başına bir JSON) stdin/stdout üstünden.

- Görev nesneye bağlı (K-008): her alanın kendi Codex oturumu (thread) var; eşleme .durum/codex-gorevler.json'da,
  sunucu yeniden başlayınca thread/resume ile aynı oturuma döner.
- Codex'in bildirimleri sıra numarasıyla birikir; tarayıcı /api/codex/akis (SSE) ile dinler.
- Codex'in istekleri (komut ya da dosya onayı, seçenekli soru) cevap gelene kadar bekler; cevap /api/codex/cevap ile döner.
- Oturumlar Codex'in kendi kaydına (~/.codex/sessions) yazılır; araclar/arsiv.py onları ham/konusmalar/'a alır.
"""
import itertools
import json
import os
import subprocess
import threading
import time

# Codex kendi karar verir (K-018): repo içinde sormadan okur ve yazar (git geri alır); sandbox dışına çıkmak (ağ, sistem) onay ister
POLITIKA = {'approvalPolicy': 'on-request', 'sandbox': 'workspace-write'}
# hafıza hook'ları Beyin'in oturumlarında kapalı: bağlamı Beyin kendisi verir (izole alanda yalnız o projeyi), bütün beyni getiren
# tur hook'u izolasyonu delmesin. Bu klasörde doğrudan açılan Codex ve Claude oturumları hook'ları kullanmaya devam eder.
AYAR = {'features': {'hooks': False}}


def oturum_ayari(kok):
    """Oturum ayarı: hook'lar kapalı; hafıza indeksinin (vault dışında, .beyin-runtime.json) yazılabilir olması gerekir,
    yoksa Codex'in beyin.py note-create / receipt / sync çağrıları sandbox'ta düşer. Ağ açık (K-026): nottaki link ve
    YouTube videosu okunabilsin; yazma yine yalnız repo ve hafıza indeksi."""
    try:
        with open(os.path.join(kok, '.beyin-runtime.json'), encoding='utf-8') as f:
            durum = json.load(f).get('state')
    except (OSError, ValueError):
        durum = None
    return {**AYAR, 'sandbox_workspace_write': {'network_access': True, **({'writable_roots': [durum]} if durum else {})}}
OLAY_SINIRI = 3000
OLCUM_SINIRI = 500  # .durum/codex-olcum.jsonl'da tutulan son tur sayısı (S-017)


class Kopru:
    def __init__(self, kok, durum_klasoru):
        self.kok = kok
        self.gorev_dosyasi = os.path.join(durum_klasoru, 'codex-gorevler.json')
        self.surec = None
        self.hata = ''
        self.kilit = threading.Lock()          # süreç başlatma
        self.yaz_kilidi = threading.Lock()     # stdin
        self.kosul = threading.Condition()     # olay akışı
        self.sayac = itertools.count(1)
        self.bekleyen = {}                     # istek id -> [Event, cevap]
        self.istekler = {}                     # Codex'in açık istekleri: id -> mesaj
        self.olaylar, self.sira = [], 0
        self.aktif_tur = {}                    # thread -> turn id
        self.son_is = {}                       # thread -> o an ne yapıyor: {is, yol} (liste ve Canlı için)
        self.yuklu = set()                     # bu süreçte açılmış ya da devam ettirilmiş thread'ler
        self.tur_bitince = None                # thread -> None; sunucu Defter kilidini burada denetler (K-066)
        self.bildirim = None                   # Codex'in her bildirimi; okuyucu thread'inde çağrılır, bekletmemeli (K-077)
        self.izin_profili = None               # alan -> Codex izin profili ya da None; izole çalışma alanında okuma engeli (K-079)
        self.izoleler = set()                  # izin profiliyle açılmış thread'ler: turda sandboxPolicy gönderilmez, profili ezerdi
        self.tur_ozeti = None                  # tur bitince {alan, thread, durum, yazdi, mesajlar}; sunucu receipt'i buradan gönderir (S-017)
        self.olcum = {}                        # thread -> süren turun ölçümü (S-017)
        self.olcum_dosyasi = os.path.join(durum_klasoru, 'codex-olcum.jsonl')
        try:
            with open(self.gorev_dosyasi, encoding='utf-8') as f:
                self.gorevler = json.load(f)
        except (OSError, ValueError):
            self.gorevler = {}

    # Süreç
    def calisiyor(self):
        return self.surec is not None and self.surec.poll() is None

    def baslat(self):
        with self.kilit:
            if self.calisiyor():
                return
            self.yuklu.clear()
            self.aktif_tur.clear()
            try:
                # Beyin klasörü bu süreç için güvenilir sayılır; yoksa yeni kurulumda hafıza kancaları (.codex/hooks.json) kapalı kalır.
                # Kullanıcının ~/.codex/config.toml'una yazılmaz, yalnız bu sürecin ayarıdır.
                # Değer satır içi tablo: Codex -c anahtarını noktadan böler, "/Users/ali.veli/Beyin" gibi yol anahtarda bozulur
                guven = 'projects={' + json.dumps(os.path.realpath(self.kok)) + '={trust_level="trusted"}}'
                self.surec = subprocess.Popen(['codex', 'app-server', '-c', guven, '--enable', 'default_mode_request_user_input'], cwd=self.kok,
                                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)
            except FileNotFoundError:
                self.hata = ('Codex kurulu değil. Terminalde: npm install -g @openai/codex, sonra codex login. '
                             'Ardından Beyin\'i kapatıp yeniden aç.')
                raise RuntimeError(self.hata)
            except OSError as e:
                self.hata = 'Codex başlatılamadı: ' + str(e)
                raise RuntimeError(self.hata)
            threading.Thread(target=self._oku, daemon=True).start()
            threading.Thread(target=self._hata_oku, daemon=True).start()
        self.istek('initialize', {'clientInfo': {'name': 'beyin', 'title': 'Beyin', 'version': '0.1'}})
        self._yaz({'method': 'initialized'})
        self.hata = ''
        self._olay({'method': 'beyin/hazir', 'params': {}})

    def _yaz(self, mesaj):
        with self.yaz_kilidi:
            self.surec.stdin.write((json.dumps(mesaj, ensure_ascii=False) + '\n').encode())
            self.surec.stdin.flush()

    def _oku(self):
        surec = self.surec
        for satir in surec.stdout:
            try:
                m = json.loads(satir)
            except ValueError:
                continue
            if 'method' not in m and 'id' in m:
                kayit = self.bekleyen.get(m['id'])
                if kayit:
                    kayit[1] = m
                    kayit[0].set()
            elif 'id' in m:
                self.istekler[m['id']] = m
                self._olay({'method': 'beyin/istek', 'params': {**(m.get('params') or {}), 'istekId': m['id'], 'tur': m['method']}})
            else:
                self._olay(m)
        for kayit in list(self.bekleyen.values()):
            kayit[1] = {'error': {'message': 'Codex kapandı'}}
            kayit[0].set()
        self._olay({'method': 'beyin/kapandi', 'params': {'hata': self.hata}})

    def _hata_oku(self):
        for satir in self.surec.stderr:
            metin = satir.decode('utf-8', 'replace').strip()
            if metin and ('error' in metin.lower() or 'hata' in metin.lower()):
                self.hata = metin[-300:]

    def istek(self, yontem, params, zaman_asimi=120):
        kimlik = next(self.sayac)
        kayit = self.bekleyen[kimlik] = [threading.Event(), None]
        self._yaz({'id': kimlik, 'method': yontem, 'params': params})
        if not kayit[0].wait(zaman_asimi):
            self.bekleyen.pop(kimlik, None)
            raise RuntimeError(f'Codex {yontem} için cevap vermedi')
        cevap = self.bekleyen.pop(kimlik)[1]
        if 'error' in cevap:
            raise RuntimeError((cevap['error'] or {}).get('message') or 'Codex hata döndü')
        return cevap.get('result') or {}

    def _is_adi(self, item):
        """Başlayan adımın kısa adı ve dokunduğu dosya (göreli yol): Düşünüyor, Okuyor, Yazıyor, Cevap yazıyor."""
        goreli = lambda y: os.path.relpath(y, self.kok) if y and os.path.isabs(y) else (y or '')
        tur = item.get('type')
        if tur == 'reasoning':
            return {'is': 'Düşünüyor', 'yol': ''}
        if tur == 'agentMessage':
            return {'is': 'Cevap yazıyor', 'yol': ''}
        if tur == 'fileChange':
            return {'is': 'Yazıyor', 'yol': goreli(((item.get('changes') or [{}])[0]).get('path'))}
        if tur == 'commandExecution':
            komut = str(item.get('command') or '')
            yol = next((k.strip('\'"') for k in komut.split() if '/' in k or k.endswith(('.md', '.html', '.json'))), '')
            okur = any(k in komut for k in ('cat ', 'sed ', 'head ', 'rg ', 'grep ', 'ls ', 'nl '))
            return {'is': 'Okuyor' if okur else 'Komut çalıştırıyor', 'yol': goreli(yol)}
        return None

    def isit(self):
        """Sunucu açılırken arka planda: süreç ve model listesi hazır olsun, ilk mesaj soğuk başlangıcı beklemesin."""
        try:
            self.modeller()
        except RuntimeError:
            pass

    # Tur ölçümü (S-017): gönderiden ilk adıma, ilk söze ve bitişe süre; Codex program alanında /api/codex/olcum ile okur
    def _olc(self, m):
        p = m.get('params') or {}
        o = self.olcum.get(p.get('threadId'))
        if not o:
            return
        yontem, gecen = m.get('method') or '', time.time() - o['t0']
        if yontem == 'item/started':
            o['adim'] += 1
            o.setdefault('ilk_adim', round(gecen, 1))
            if (p.get('item') or {}).get('type') in ('commandExecution', 'fileChange'):
                o['arac'] += 1
        elif yontem == 'item/agentMessage/delta':
            o.setdefault('ilk_soz', round(gecen, 1))
        elif yontem == 'beyin/pano-akis':  # pano mesajdan akıyor (K-077): dosya adımı yok, 'arac' eski turlarla kıyaslanmaz
            o['pano_akis'] = o.get('pano_akis', 0) + (1 if p.get('basla') else 0)
            o.setdefault('ilk_pano', round(gecen, 1))
        elif 'tokenUsage' in yontem:
            o['token'] = p.get('tokenUsage')
        elif yontem == 'item/completed':  # tur özeti için: yazılan dosyalar ve son cevap ('_' ile başlayan alan ölçüm kaydına girmez)
            item = p.get('item') or {}
            if item.get('type') == 'fileChange':
                o.setdefault('_yazdi', []).extend(os.path.relpath(c['path'], self.kok) if os.path.isabs(c.get('path') or '') else (c.get('path') or '')
                                                  for c in item.get('changes') or [] if c.get('path'))
            elif item.get('type') == 'agentMessage':  # pano bloğu ara mesajda olabilir: hepsi tutulur, özet son mesajdan
                o.setdefault('_mesajlar', []).append(item.get('text') or '')
        elif yontem == 'turn/completed':
            self.olcum.pop(p.get('threadId'), None)
            kayit = {**{k: v for k, v in o.items() if k != 't0' and not k.startswith('_')}, 'toplam': round(gecen, 1),
                     'durum': (p.get('turn') or {}).get('status'), 'zaman': time.strftime('%Y-%m-%dT%H:%M:%S')}
            if self.tur_ozeti:
                self.tur_ozeti({'alan': o.get('alan'), 'thread': p.get('threadId'), 'durum': kayit['durum'],
                                'yazdi': list(dict.fromkeys(o.get('_yazdi', []))), 'mesajlar': o.get('_mesajlar', [])})
            try:
                with open(self.olcum_dosyasi, encoding='utf-8') as f:
                    eski = f.read().splitlines()[-(OLCUM_SINIRI - 1):]
            except OSError:
                eski = []
            with open(self.olcum_dosyasi, 'w', encoding='utf-8') as f:
                f.write('\n'.join(eski + [json.dumps(kayit, ensure_ascii=False)]) + '\n')

    def olcumler(self, son=40):
        try:
            with open(self.olcum_dosyasi, encoding='utf-8') as f:
                return [json.loads(x) for x in f.read().splitlines()[-son:] if x.strip()]
        except (OSError, ValueError):
            return []

    # Olay akışı
    def _olay(self, m):
        p = m.get('params') or {}
        self._olc(m)
        if self.bildirim and not (m.get('method') or '').startswith('beyin/'):
            self.bildirim(m)
        if m.get('method') == 'turn/started':
            self.aktif_tur[p.get('threadId')] = (p.get('turn') or {}).get('id')
        elif m.get('method') == 'turn/completed':
            self.aktif_tur.pop(p.get('threadId'), None)
            self.son_is.pop(p.get('threadId'), None)
            if self.tur_bitince:
                self.tur_bitince(p.get('threadId'))
        elif m.get('method') == 'item/started':
            is_ = self._is_adi(p.get('item') or {})
            if is_:
                self.son_is[p.get('threadId')] = is_
        with self.kosul:
            self.sira += 1
            self.olaylar.append({'sira': self.sira, **m})
            del self.olaylar[:-OLAY_SINIRI]
            self.kosul.notify_all()

    def bekle(self, son, zaman=15):
        with self.kosul:
            self.kosul.wait_for(lambda: self.sira > son, timeout=zaman)
            return [o for o in self.olaylar if o['sira'] > son]

    # Görevler: alan başına bir thread
    def gorev(self, alan, talimat):
        self.baslat()
        kayit = self.gorevler.get(alan)
        ayar = {'cwd': self.kok, 'developerInstructions': talimat, 'config': oturum_ayari(self.kok), **POLITIKA}
        # İzole çalışma alanı (K-079): başka çalışma alanlarının dosyaları sandbox'ta okunamaz (macOS, "Operation not permitted").
        # İzin profili eski 'sandbox' ayarıyla birlikte verilmez: eski ayar profili ezer.
        profil = self.izin_profili(alan) if self.izin_profili else None
        if profil:
            ayar.pop('sandbox', None)
            ayar['config'] = {**ayar['config'], 'default_permissions': 'beyin_izole', 'permissions': {'beyin_izole': profil}}
        if kayit and kayit['thread'] in self.yuklu:
            return kayit['thread']
        if kayit:
            try:
                self.istek('thread/resume', {'threadId': kayit['thread'], **ayar})
                self.yuklu.add(kayit['thread'])
                (self.izoleler.add if profil else self.izoleler.discard)(kayit['thread'])
                return kayit['thread']
            except RuntimeError:
                pass  # kayıt bozuk ya da silinmiş: yeni oturum
        thread = self.istek('thread/start', ayar)['thread']['id']
        self.gorevler[alan] = {'thread': thread}
        self.yuklu.add(thread)
        if profil:
            self.izoleler.add(thread)
        self._kaydet()
        return thread

    def _kaydet(self):
        os.makedirs(os.path.dirname(self.gorev_dosyasi), exist_ok=True)
        with open(self.gorev_dosyasi, 'w', encoding='utf-8') as f:
            json.dump(self.gorevler, f, ensure_ascii=False, indent=1)

    def gonderilen(self, alan):
        """Alanın thread'ine daha önce giden bağlamın izi (kimlik özeti, notlar, tur sayısı); yeni thread boş başlar."""
        return self.gorevler.get(alan) or {}

    def isaretle(self, alan, **iz):
        if alan in self.gorevler:
            self.gorevler[alan].update(iz)
            self._kaydet()

    def gonder(self, alan, metin, talimat, ekler=(), model=None, efor=None, internet=None, katman=None):
        """Ekler (etiketli bağlam blokları) mesajdan önce gider; model, efor ve internet bu turdan itibaren geçerli.
        İnternet kapalıysa Codex link ve video okuyamaz, yalnız bu bilgisayardaki dosyalarla çalışır (K-036)."""
        thread = self.gorev(alan, talimat)
        girdi = [{'type': 'text', 'text': t, 'text_elements': []} for t in (*ekler, metin)]
        params = {'threadId': thread, 'input': girdi}
        if not model or not efor:
            # Panel seçimini göndermediyse (sınama, API, model listesi daha gelmemişken yazılan mesaj) tur Codex'in kendi
            # ayarına düşer: ölçüldü, gpt-5.6-sol ve en yüksek seviye, 76 sn. Panelin varsayılanıyla aynı olsun.
            try:
                liste = self.modeller()
            except RuntimeError:
                liste = []
            m = next((x for x in liste if x['id'] == model), None) or (None if model else next((x for x in liste if x['varsayilan']), None))
            if m:
                model, efor = model or m['id'], efor or m.get('varsayilanEfor')
        if model:
            params['model'] = model
        if efor:
            params['effort'] = efor
        if internet is not None and thread not in self.izoleler:
            yazilabilir = oturum_ayari(self.kok)['sandbox_workspace_write'].get('writable_roots') or []
            params['sandboxPolicy'] = {'type': 'workspaceWrite', 'networkAccess': bool(internet), 'writableRoots': yazilabilir}
        elif internet is False:  # izole thread'de turun sandbox'ı profili ezerdi (K-079): internet kapalıyken söz düzeyinde
            params['input'] = [{'type': 'text', 'text': '<internet>Bu turda internet kapalı: web araması yapma, link ve video açma; yalnız bu bilgisayardaki dosyalar.</internet>', 'text_elements': []}] + params['input']
        if katman:  # hız katmanı yalnız bu tur için (K-077: çizim turları Fast); thread'in katmanı değişmez
            params['serviceTierForTurn'] = katman
        self.olcum[thread] = {'t0': time.time(), 'alan': alan, 'model': model, 'efor': efor, 'katman': katman or 'standart',
                              'baglam': sum(len(t) for t in ekler), 'mesaj': len(metin), 'adim': 0, 'arac': 0}
        tur = self.istek('turn/start', params)
        return {'thread': thread, 'tur': (tur.get('turn') or {}).get('id')}

    def gorev_birak(self, alan):
        """Silinen sayfanın görev eşlemesi düşer (thread Codex'in kendi kaydında kalır)."""
        if self.gorevler.pop(alan, None) is not None:
            self._kaydet()

    def tek_tur(self, talimat, ekler, metin, sema, model=None, efor='low', zaman_asimi=120):
        """Yazı arkadaşı önerisi gibi kısa işler: iz bırakmayan (ephemeral), salt okunur bir thread'de tek tur; son mesaj
        sema'ya uyan JSON. Görev eşlemesine ve konuşma arşivine girmez."""
        ayar = {'cwd': self.kok, 'developerInstructions': talimat, 'ephemeral': True, 'approvalPolicy': 'never',
                'sandbox': 'read-only', 'config': AYAR, **({'model': model} if model else {})}
        self.baslat()
        thread = self.istek('thread/start', ayar)['thread']['id']
        son = self.sira
        girdi = [{'type': 'text', 'text': t, 'text_elements': []} for t in (*ekler, metin)]
        self.istek('turn/start', {'threadId': thread, 'input': girdi, 'outputSchema': sema, 'effort': efor})
        cevap, bitis = '', time.time() + zaman_asimi
        while time.time() < bitis:
            for o in self.bekle(son, 5):
                son = o['sira']
                p = o.get('params') or {}
                if p.get('threadId') != thread:
                    continue
                if o.get('method') == 'item/completed' and (p.get('item') or {}).get('type') == 'agentMessage':
                    cevap = p['item'].get('text') or ''
                elif o.get('method') == 'turn/completed':
                    return cevap
        raise RuntimeError('Codex öneriyi zamanında bitiremedi')

    def modeller(self):
        """Codex'in sunduğu modeller (gizliler hariç), bir kez sorulur."""
        if not getattr(self, '_modeller', None):
            self.baslat()
            veri = self.istek('model/list', {}).get('data') or []
            efor = lambda e: e.get('reasoningEffort') if isinstance(e, dict) else e
            self._modeller = [{'id': m.get('model') or m.get('id'), 'ad': m.get('displayName') or m.get('model'), 'aciklama': m.get('description') or '',
                               'varsayilan': bool(m.get('isDefault')), 'eforlar': [efor(e) for e in m.get('supportedReasoningEfforts') or []],
                               'varsayilanEfor': m.get('defaultReasoningEffort')} for m in veri if not m.get('hidden')]
        return self._modeller

    def dur(self, alan):
        thread = (self.gorevler.get(alan) or {}).get('thread')
        tur = self.aktif_tur.get(thread)
        if thread and tur and self.calisiyor():
            self.istek('turn/interrupt', {'threadId': thread, 'turnId': tur})
        return bool(tur)

    def gecmis(self, alan, talimat):
        """Alanın oturumu varsa geçmişi (turlar ve parçalar); yoksa boş. Oturum yoksa Codex başlatılmaz."""
        kayit = self.gorevler.get(alan)
        if not kayit:
            return {'thread': None, 'turlar': []}
        thread = self.gorev(alan, talimat)
        oku = self.istek('thread/read', {'threadId': thread, 'includeTurns': True})
        turlar = [{'id': t.get('id'), 'durum': t.get('status'), 'parcalar': t.get('items') or []} for t in (oku.get('thread') or {}).get('turns') or []]
        return {'thread': thread, 'turlar': turlar, 'calisiyor': thread in self.aktif_tur}

    def cevapla(self, istek_id, sonuc):
        if istek_id not in self.istekler:
            raise RuntimeError('Bu istek artık açık değil')
        self.istekler.pop(istek_id)
        self._yaz({'id': istek_id, 'result': sonuc})
        self._olay({'method': 'beyin/istek-kapandi', 'params': {'istekId': istek_id}})

    def acik_istekler(self, thread):
        return [{**(m.get('params') or {}), 'istekId': i, 'tur': m['method']} for i, m in self.istekler.items()
                if (m.get('params') or {}).get('threadId') == thread]
