---
visibility: private
kind: instruction
---
# Beyin: şema

Görsel önce ikinci beyin. Alan görselleşir, karar ve soru o görselin bir bölümüne not olarak iğnelenir,
konuşma git'te kalır. Bu dosya Claude ve Codex'in buraya nasıl yazdığını söyler; sürtünme görüldükçe güncellenir
ve her değişikliği commit'lenir.

Kendi başına bir program: hiçbir skill'e (tuval dahil), dış klasöre ya da başka repoya bağlı değil. Tuval skill'i
burada kullanılmaz; tasarım bu reponun kendi panolarında yapılır.

İki kat (K-021). Alt kat hafıza katmanı (V3), bu klasöre kurulu: kendini geliştiren hafıza (kimlik ben/, knowledge/,
görev, receipt, yerel indeks; komutlar `python3 beyin.py`, kurallar AGENTS.md'deki hafıza bölümü ve
`.agents/skills/beyin/SKILL.md`). Üst kat Beyin: görsel katman (tuval, çizim modu, ağ, Codex arayüzü) ve izole çalışma
alanları. Her not ortak beyne girer; izole çalışma alanında kaynak ve süreç yalnız o alandan gelir. Hafıza katmanının hook ve
skill'leri yalnız bu klasörde; globale bir şey kurulmaz. Güncelleme: `python3 beyin.py update` ya da "Beyni Güncelle".

Aç: "Beyni Aç.command"a çift tıkla (arka planda başlatır, pencereyi açar; terminalden `./baslat.sh`) → http://127.0.0.1:4700 · Kapat: "Beyni Kapat.command" ya da Ayarlar › Program › Beyin'i kapat (`/api/kapat`, K-076) · Pano biçimi: `PANO.md` · Doğrula: `node araclar/pano.mjs <Pano.dc.html>` · Duman sınaması: hepsi `sh araclar/tum-duman.sh` (Codex turu açanlarla `--codex`), tek tek `node araclar/duman.mjs`, alan ekranı `node araclar/sayfa-duman.mjs`, yazı arkadaşı `node araclar/oneri-duman.mjs` (gerçek Codex turu); kimlik ve PWA `node araclar/kimlik-duman.mjs`, Codex kutusu ve çöp `node araclar/yazi-duman.mjs` (gerçek Codex turu), canlı hal `node araclar/canli-duman.mjs`, canlı çizim `node araclar/canli-cizim-duman.mjs`, yazı arkadaşı `node araclar/arkadas-duman.mjs`, Codex sohbeti `node araclar/sohbet-duman.mjs`, Bilgi `node araclar/bilgi-duman.mjs`, Kaynaklar ve video `node araclar/kaynak-duman.mjs` (gerçek indirme ve Codex özeti), hızlı eylemler `node araclar/eylem-duman.mjs` (gerçek Codex turu), ray ve ⌘K `node araclar/ray-duman.mjs`, liste sıralama `node araclar/sira-duman.mjs`, yerel video `node araclar/video-yerel-duman.mjs` (gerçek Codex özeti), video görünümü `node araclar/video-gorunum-duman.mjs` (gerçek Codex özeti), tuval araçları `node araclar/arac-duman.mjs`, alan kaldırma ve koyu tuval `node araclar/alan-sil-duman.mjs`, Defter'e link bırakma `node araclar/defter-link-duman.mjs`, Codex düzenlemesinin videoyu beklemesi `node araclar/veri-bekle-duman.mjs`, Ayarlar › Çalışma alanları, Ben, ⋯ menüsü ve Entegrasyonlar `node araclar/ayar-duman.mjs`, Defter'de blok seçimi ve link `node araclar/defter-secim-duman.mjs`, Defter kilidi `python3 araclar/defter-kilidi-sinama.py` (Codex'siz, geçici kasada) ve bildirimi `node araclar/defter-kilidi-duman.mjs`, video altyazı seçimi ve araç klasörü `python3 araclar/video-sinama.py`; hepsi geçici alan açıp kaldırır (`araclar/gecici-alan.mjs`)

Açık kaynak (K-081): program https://github.com/berkaysirtas/pixelBrain'de, bu kasa kaynak kopya. Yayın `python3 araclar/yayinla.py
--not "..."` (liste `yayin/liste.json`, tarama `yayin/yasak.txt`, `--dene` göndermez). Kullanıcı tarafı `motor/guncelle.py`
(yalnız `program.json`'daki dosyalar; yedek `.durum/guncelleme/`), Ayarlar › Program › Sürüm (`/api/surum`, `/api/guncelle`).
Hafıza katmanı `hafiza/` paketinde; kurulumda ve güncellemede kurucusu koşar. Kaynağın yeni sürümü `python3 araclar/hafiza-al.py
--kur` ile pakete alınır (sağlama, yamalar, ad temizliği; tutmayan yamada durur). Yayın commit'lenmiş hâlden (HEAD) kurulur.
Kurulum kılavuzu `yayin/KURULUM.md` (ajan okur), görseller `python3 yayin/gorsel.py`, README ekranları (kurgusal
örnekle, arayüz değişince) `python3 yayin/ekranlar.py`. Ad pixelBrain, lisans `yayin/LICENSE` (Apache 2.0 ve ek
koşullar, K-083): Sürüm kartının altındaki ad ve telif satırı lisansın koruduğu yer, kaldırılmaz.
Güvenlik kapısı (`sunucu.py` › `Istek.yabanci`): Host yalnız 127.0.0.1 ya da localhost; tarayıcıdan gelen yazma ve /api okuması
yalnız Beyin'in kendi sayfasından (başka site CSRF ile çalışma alanı açabiliyordu, sahte Host ile notlar okunabiliyordu). Yeni uç
bu kapıdan geçer; Origin'siz istek (curl, Beyni Aç ve Kapat) geçer. Yayın GitHub denetimi (`.github/workflows/denetim.yml`,
kaynağı `yayin/github/`) yeşil olmadan çıkmaz; güncelleyicinin sınaması `python3 araclar/guncelle-sinama.py`. Kaynak kopyada kurulum ve güncelleme reddedilir.

## Kabuk
`/` kabuk (`motor/beyin.html`), sade iskelet (K-029, pano `SadeIskelet.dc.html`): her şeyin tek ve sabit bir yeri var.
- Kenar çubuğu ray ve liste (K-038 adım 4), düğmesiz: rayda beyin ikonu (Ortak beyin), çalışma alanlarının renkli kareleri
  (izoleyse kilit rozeti), +, altta Çöp, Ben, Ayarlar (dişli). Liste yalnız seçili çalışma alanının (başında adı ve
  İzole/Açık, Ara ⌘K, alanlar); kendi açılır, kendi kapanır: çalışma alanı karesinin üstüne gelince yüzer, fare çekilince
  kısa beklemeyle kapanır. Sayfa raydan (56px) sonra başlar. Seçili çalışma alanı `localStorage` `beyin:ray`. ⌘K
  (`komutAc`, tuvalde de çalışır) çalışma alanı, alan, pano ve sayfaya gider; genel kullanım ⌘K ile.
- Pixel art ikonlar (K-039 adım 1): Codex her çalışma alanı ve alan için 12×12 ızgara çizer (`.kabc`: kontur, ana renk, açık
  ton, vurgu; renk çalışma alanından), `calisma.json`da `ikon_px`. Sıralı arka plan işçisi (`ikon_ciz_sirala`, `_ikon_dongu`;
  ana model, orta düşünme, ikon başına ~26 sn): yeni alan açılırken bir kez ya da "İkon çizdir" ile; açılışta eksik ikon çizilmez (K-074). `/api/ikon-ciz`, `/api/ikon-durum`.
  Yalnız rayda, listede (⌘K dahil), ağdaki alan düğümünde (`pxCiz`, tuvale piksel piksel) ve Defter ile Bilgi başlığında;
  emoji gösterilmez, yol çubuğu yalnız ad. Seçici: ikon önizleme, isteğe bağlı tarif, "Yeniden çiz"; çizilirken nabız.
- Liste durumu (K-039 adım 2, `/api/alan-durum`, `durumIzle`): alan satırında son değişiklik (Defter, Bilgi, notlar, kaynaklar,
  panolar) ve Codex oradaysa nabız; rayda etkinlik noktası; altta Canlı: Codex hangi alanda ne yapıyor ve hangi dosya
  (`Kopru.son_is`, item/started'dan), süren videolar, çizilen ikon. Bir şey sürerken 3 sn, yoksa 30 sn'de bir sorulur.
- Codex'in gerçek yeri (K-039 adım 3): taslak pano ve gezinen imleç kalktı (ölçüm: Codex panoyu tek yamayla yazar, akış yok).
  Tuval `codexYeri`: hal.is ve hal.ayrinti'deki pano adlarından okunan pano kesik çerçeve ve "Codex okuyor", yazılan ya da
  revize edilen pano dolu çerçeve ve "Codex yazıyor"; yeni pano kendi yerinde açılır, imleç onun üstünde. Bilgi
  (`bilgiYazildi`): yazmadan önceki bloklarda olmayanlar vurgulanır, ilkinde "Codex yazdı", ekran oraya kayar; sekme kapalıysa nokta.
- Defter boş durmasın (K-039 adım 4, `defterCevre`): pixel ikonlu başlık, ilk alıntı alt başlık gibi, sayılar satırı (çalışma
  alanı, son değişiklik, karar, açık soru, pano; tıklayınca Bilgi ya da Çizim), Defter boşken davet satırı, altta şerit:
  Çizim'deki ilk üç panonun küçük resmi ve Bilgi'nin son bölümü (Bilgi sayfası yoksa yaratılmaz).
- Üst çubuk her sekmede aynı yerde: Defter, Bilgi, Çizim sekmeleri kaymaz; Çizim'de çubuk tuvalin üstünde saydam durur.
- Çöp (`copCiz`): dar sayfa, Alanlar ve Sayfalar grupları, satırda renkli ikon kutusu, Geri yükle ve iki adımlı Sil.
  Sınamalar kendi çöp kayıtlarını siler (kimlik sınaması geçici çalışma alanınınkileri).
  Nottaki `[ad](…panolar/Pano.dc.html)` bağı panonun alanının Çizim'inde açılır (`panoyaGit`).
- Bir alan bir ekran (`#/c/<ç.alanı>/<alan>[/yazi|/cizim|/<Pano.dc.html>]`): Defter (alanın tek notu), Çizim (alanın tuvali,
  `/pano?yalin=1#<sayfa>`), sağda tek Codex. Konuşmadan doğan kararlar ve sorular (iğneler) Defter'in altında, katlanır
  (`igneCiz`). Ortak beyin yalnız görür; alan dışı not Kişisel › Genel alanına. Eski `#/sayfa/<id>` ve `/konu/` adresleri
  alanın Defter'ine yönlenir. Yapıyı oynatan yeni fikir önce panoya gelir, onaylanınca tek seferde yapılır.
- Her ekranda "+ Veri" (V, sürükle bırak) bulunulan yere veri ekler: düğmenin altında küçük kart, sayfayı itmez (K-030);
  Defter'e bırakılan dosya da veriye girer.
- Çizim sekmesinde tuval tam alan (`body.cizimde`, K-030): üst çubuk dar düzendeki gibi yüzen hap, Codex sağda yüzen kart.
- Ayarlar (K-060): Görünüş, Çalışma alanları (satır: sürükle, İzole, ad, ikon, Kaldır; açılınca alanları: Taşı, Kaldır), Program,
  Kısayollar. Ben Ortak beyinde sekme (`#/ben` oraya gider); Ortak beyin sekmeleri üst çubukta: Ağ, Ben, Son eklenenler. ⋯ menüsü
  (K-061): Codex ile, Bu alan (Yeniden adlandır `/api/kimlik` ad, Taşı `/api/alan-tasi`), soluk Alanı kaldır. Çalışma alanı
  alanlarıyla Çöp'e gider ve birlikte döner (kayıtta grup).
- Kimlik (K-031): çalışma alanının `ikon` (emoji) ve `renk` (tema.css `--r-*`), alanın `ikon`u `calisma.json`da; `/api/kimlik`.
  Seçici yol çubuğundaki avatardan ve Defter'in başındaki ikondan açılır. Alanı Defter'in ⋯ menüsünden, boş çalışma alanını
  seçiciden kaldır. Alan (K-055) ⋯ menüsünden, listedeki satırın ⋯'sinden, galeri kartından ya da sağ tıkla her şeyiyle çöpe gider (`/api/alan-kaldir`: Defter, panolar, tuval öğeleri, kararlar, veri); Çöp hepsini geri yükler, kalıcı silme pano dosyasını da siler. Çalışma alanı boşsa kaldırılır (`/api/calisma-kaldir`).
- Alan üç sekme (K-038): Defter (`ana: evet`, yalnız kullanıcı yazar), Bilgi (`bilgi: evet`, `/api/alan-bilgi`, Codex yazar:
  özet, kümeler, veri yorumu; kararlar ve sorular burada; blokta "Defter'e al" bölümü Defter'in sonuna ekler), Çizim. Codex'e
  her turda `<yazma_kurali>` gider: Defter'e kendiliğinden yazma, çıktın Bilgi'ye. Bilgi'de Özetle, Kümele, Verileri yorumla.
- Bilgi haritası (K-043, pano `ArayuzBilgiR1`, `bilgiCiz`/`bilgiHaritasi`): noktalı zemin; üstte Özet kartı (`## Özet`, yoksa
  başlıksız giriş), diğer `## ` bölümleri renkli adacık (bölümde `### ` varsa her biri ayrı), maddeler kart, tablo gerçek tablo;
  sağda kaynaklar (Defter, kararlar ve sorular, `#blKaynak`), kaynaktan Özet'e kesik çizgi. Ajan A (`bilgiAjan`, `notHal`'den):
  Codex çalışırken altta hap (iş, okuduğu kaynak sayısı, Durdur `/api/codex/dur`); okunan kaynak kesik çerçeve ve "okundu".
- Video düğmesi (K-045): tek parça çubuğun yanında; YouTube linki `/api/video`, bilgisayardan video `/api/veri` (video uzantılı dosya
  alanda kendiliğinden sıraya girer). Yerel videoda ffprobe süre, mlx_whisper transkript, ffmpeg 16 kare (`kare-NN.jpg`), özet aynı.
- Kaynaklar (K-038 adım 2, Bilgi'nin altında, `/api/kaynaklar`): alanın dosya ve linkleri, YouTube videoları. `/api/video`
  ya da Veri'ye yapıştırılan YouTube linki sıraya girer; sunucudaki tek işçi Beyin'in kendi süreciyle (K-067) yt-dlp ile
  indirir (altyazı varsa o, yoksa mlx_whisper yerelde dinler), ffmpeg ile 16 kare çıkarır, transkripti ve kareleri
  `ham/kaynaklar/<ca>/<alan>/video/<vid>/`a koyar, Codex tek turla özeti Bilgi'de `## Videolar` altına yazar. Araçlar
  `.arac/video`da (git dışı, `sh araclar/video-kur.sh`; global watch-youtube skill'ine bağlı değil, kurulmadıysa geçici olarak
  eski klasörün yt-dlp ve mlx_whisper'ı). Aşamalar `.durum/videolar.json`da (sırada, indiriliyor, dinleniyor, kareler,
  özetleniyor, bitti, hata); yarıda kalan iş açılışta yeniden sıraya girer.
- Hızlı eylemler (K-038 adım 3, `motor/index.html` `#eylem`): seçimin üstünde koyu çubuk. Tek pano: Revize et… (satır içi
  istek, boşsa baştan çizer), Genişlet, Doğrula, Sor…; çoklu: Kümele, Birleştir, Karşılaştır, Sor…. Tuval `beyin: 'eylem'`
  yollar, kabuk (`panoEylemi`) sohbete kısa adı yazar, sunucu `<pano_eylemi>` bloğunu kurar (`PANO_EYLEMLERI`). Eski panolar
  silinmez: revize aynı panoyu günceller, önceki sürüm `.durum/pano-surum/`a kopyalanır; öbürleri yeni panoyu tuvalin bulduğu
  boş yere (`bosYer`, seçimin sağı) koyar, taslak pano orada belirir. Codex çalışırken çubuk kilitli (Sor hariç).
- Ortak beyin (K-035, `ortakAgCiz`, `motor/ag.js`): tam ekran ağ; alanlar merkez, Defter bölümleri, notlar, bilgi notları,
  gerçek bağlar. Arama, çalışma alanı süzgeci, Doğrulama: varsayım kesikli, açık soru sarı, Codex bulgusu kırmızı halka.
  Sağlık sağ üstte rozet (bekleyen sayısı), tıklayınca kart açılır; modelsiz (`/api/saglik`); "Codex'le tara" elle
  (`/api/codex/tara`, `.durum/tarama.json`). Çalışma alanı sayfasında ayrı Ağ sekmesi yok: "Ağda gör" Ortak beyni ona süzer.
- Ayarlar sekmeli (K-038 adım 5): Ben (eski `#/ben` buraya gelir), Program (program notları, kurulum, hatalar, hafıza),
  Kısayollar. Sabit açıklama yazıları kalktı, gerekenler `title` ipucunda.
  Varsayımı onayla: `/api/not-onay` notun ön bilgisine `onay:` ekler.
- İlk kurulum turu (K-051, `motor/kurulum.js`): gerçek ekranda yedi adım, hedef sarı halkayla ışıklanır, son adım Seni tanıyayım
  (Core.md'ye yalnız değişen alan). İlk açılışta kendiliğinden (Core.md boş), sonra ⌘K "Turu başlat" ve Ayarlar › Program.
  ⌘K eylemleri `window.komutEylemleri`'nden gelir. Sınama `node araclar/kurulum-duman.mjs`.
- Defter kilidi (K-066, K-038'in zorunlu hâli; `sunucu.py` › `defter_denetle`): Codex turu başlarken alanın Defter dosyaları
  kopyalanır, turda sunucunun yazdığı her sayfa (kullanıcı kaydı) kopyayı tazeler; tur bitince Codex'in izinsiz değişikliği
  `.durum/codex-defter/`'e yedeklenip geri alınır, kabuk bir kez bildirir. Mesajda açıkça "Defter'e yaz" denirse kilit yok.
- Sayfa iskeleti (K-070): `.sayfa` (geniş olmayan) noktalı zeminde 980 px'lik kâğıttır, Defter'in kâğıdıyla aynı yerde; üst çubuk
  üstünde yüzer. Çalışma alanı, Çöp, Ayarlar, Ben ve Son eklenenler bu kabukta. Başlık kalıbı `.sb`: `.sb-ik` 52 px ikon kutusu,
  `.sb-orta` başlık ve meta, `.sb-sag` eylemler. Yeni sayfa bu ikisini kullanır, kendi kolonunu ya da başlığını kurmaz.
  Defter aynı ölçüde (K-071): `.sy-ikon.px` 52 px kutu solda, `.sy-baslik` 38 px, `.sy-meta` çipleri altında, iç boşluk 64.
- Üstte açılanlar (K-072): ⌘K, + Veri, Kimlik, ⋯, model menüsü, doğrulama listesi ve Bilgi menüsü tek kart dilinde: köşe
  `--kat-kose` (12), gölge `--kat-golge`, kenar `1px solid var(--kenar)`. Yeni açılır kart bu ikisini kullanır, kendi gölgesini
  yazmaz. Karartma ve × yok: dışarı tık ya da Esc kapatır (+ Veri'de tuvale tıklamak da; `pointerdown` ve pencere `blur`).
- Codex sohbeti (K-073, `codex-panel.js`): balon `.cx-sen` dolgulu ve çerçevesiz, en çok %72; `kisalt` altı satırı geçen mesajı
  dört satırda katlar (`.cx-kisik`, `.cx-devam`), ölçü bölmenin eni değişince yenilenir. Çizim modu yalnız değişince `.cx-ayrac`.
  Adımlar `.cx-grup` içinde: `grupCiz` art arda biten adımları tek satıra (`.cx-grup-bas`, "N adım") toplar, süren adım görünür
  kalır. Sınama `node araclar/sohbet-duman.mjs` (sahte geçmiş ve akış, Codex'siz).
- Doğrulama (K-069, `sunucu.py` › `dogrula_*`): Codex'in çıkardığı bilgi kullanıcı "evet" diyene kadar tahmindir. Yazı arkadaşı
  turu nottan en çok iki bilgi çıkarır (`ogrenilen`), sohbetteki Codex çıkarımını `/api/dogrula-ekle` ile bırakır; sorular
  `.durum/dogrulama.json`'da birikir (en çok 6 bekleyen, aynısı ve reddedilen yeniden sorulmaz). Üstteki Codex düğmesinde sayı
  rozeti, tıklayınca liste: Evet, Düzelt, Hayır, Hepsine evet. Evet alanın Bilgi sayfasına (bölüm başlığı altına) ya da
  `knowledge/tercihler/`'e yazar; Defter'e yazılmaz. Sınama `araclar/dogrula-duman.mjs`.
- Codex hızı ve ölçümü (S-017): her tur `.durum/codex-olcum.jsonl`'a yazılır (süre, ilk söz, adım, araç, bağlam boyu, token),
  `/api/codex/olcum` son turları ve seviyeye göre ortancayı verir; program alanındaki Codex hızını buradan görür. Kimlik bloğu
  yalnız değişince ya da 10 turda bir, aynı not 10 tur içinde bir kez gider (iz `codex-gorevler.json`'da). Codex canvas.json'u
  okumaz ve düzenlemez; panoyu tuvale sunucu koyar (K-077; eski yol `/api/pano-yerlestir` etkileşimli panolar için durur).
  Codex sunucu açılırken ısınmaz (K-074). Ölçüm kaydında `katman`, `ilk_pano` ve `pano_akis` da var; özet seviye ve katmana göre.
  Hafıza yükü: talimat arama komutunu verir; Codex beyin skill'ini ve `--help`'i her turda okumaz, `sync` ve receipt çalıştırmaz.
  Dosya yazılan turun sonunda sunucu eşitler ve receipt'i kendisi gönderir (`tur_receipt`, `Kopru.tur_ozeti`; yalnız sohbet edilen
  turda receipt yok). Model ya da seviye gelmeyen istek panelin varsayılanıyla gider, Codex'in kendi ayarına düşmez.
- Canlı çizim (K-077): Codex panoyu dosyaya yazmaz, cevabının içinde `<pano-yaz ad= baslik= w= h= [x= y=]>…</pano-yaz>` bloğuyla
  verir (içi yalnız `<helmet>` ve kök `<div>`; iskeleti ve tema.css bağını `pano_sar` ekler). `sunucu.py` › pano akışı: Codex'in
  bildirimleri (`Kopru.bildirim`) kuyruğa girer, tek işçi (`_pano_isle`) blok açılınca yer tutucu dosyayla panoyu tuvale koyar,
  içeriği `beyin/pano-akis` olayıyla parça parça yayınlar, blok kapanınca dosyayı yazar. Okuyucu thread'i bekletilmez. Yol:
  `codex-panel.js` (`panoAyir`: sohbette blok yerine "Çiziyor / Çizdi" satırı) → kabuk `notHal` → tuval `panoAkis`, `akisCiz`
  (panonun üstünde betiksiz `iframe.akis`'e `document.write`; imleç son yazının ucunda; bitince gerçeği yüklenir). Süren akış
  `/api/pano-akis`. Tarif tek yerde: `yerlestir_tarifi` (talimatta ve `<cizim_modu>`'da; tam hâli thread'e bir kez ve 10 turda
  bir). Çizim turları `CIZIM_KATMANI` ile gider (`BEYIN_CIZIM_KATMANI`, varsayılan `priority` yani Fast; boş: standart).
  Sınama `python3 araclar/pano-akis-sinama.py`, `node araclar/canli-cizim-duman.mjs`, gerçek tur `node araclar/cizim-codex-duman.mjs`.
- Pano kiti (K-078, `panolar/pano-kit.css`): Codex panoda stil yazmaz; blokta yalnız `<div class="pk">` ve kitin sınıfları
  (`.pk-bas`, `.pk-izgara`, `.pk-kart`, `.pk-bant`, `.pk-akis`, `.pk-tik` …, renk sınıfları). `pano_sar` ve canlı çizim çerçevesi
  kiti bağlar. Sözlük `yerlestir_tarifi`'nde bire bir yazılı; kite sınıf eklenirse tarif de güncellenir (`pano-akis-sinama` denetler,
  `TARIF_SURUMU` değişir ki konuşmalara yeniden gitsin). Örnek pano `PanoKit.dc.html`.
- İzolasyon zorunlu (K-079, `sunucu.py` › `izin_profili`): izole çalışma alanının Codex konuşması `beyin_izole` izin profiliyle
  açılır (`Kopru.izin_profili`); başka alanların notlar/sayfalar/kaynak klasörleri, panoları, konuşma arşivi, receipts, daily,
  `ben/` oturum dosyaları, `.git`, canvas.json macOS sandbox'ında okunamaz. Profil eski `sandbox` ayarıyla verilmez, turda
  `sandboxPolicy` gönderilmez (ikisi de profili ezer); internet kapalıysa söz düzeyinde. Sınama `python3 araclar/izolasyon-sinama.py`,
  gerçek tur `node araclar/izolasyon-codex-duman.mjs`.
- Öğretici dersler (K-052, K-062, `motor/ogretici.js`): "Beyin'i öğren" izole çalışma alanı (`ogretici: true`), yedi ders
  alanı (`ders` anahtarı: defter, bilgi, cizim, veri, codex, izolasyon, ortak), her Defter'de anlatım ve Dene listesi. Adım
  yapılınca Defter'deki satır kendiliğinden işaretlenir; ilerlemenin tek kaynağı işaretli Dene satırlarıdır. Adımlar kabuğun
  ve tuval penceresinin POST isteklerinden, adres değişiminden, tıklama ve kısayoldan anlaşılır; Codex turu harcanmaz.
  Çalışma alanı sayfası dersleri ilerleme halkasıyla, yanda seçili dersin adımlarını gösterir; Göster sıradaki adımın yerini
  sarı halkayla ışıklar, adım yapılınca sıradakine geçer. Yalnız ⌘K "Beyin'i öğren" ya da turun son kartındaki anahtarla
  kurulur, var olan ders yeniden kurulmaz. Sınama `node araclar/ogretici-duman.mjs` (Codex'siz, kurduğunu siler).
- Model düğmesi (K-036): model, düşünme çubukları, internet küresi; internet tur başına (`sandboxPolicy.networkAccess`).
- Codex'in canlı hali (K-034): üst çubukta durum yok. Panelde süren adım parıldar; panel kapalıyken baloncuğun yanında söz
  (`codexSozHal`, okunan dosyalarla; "Bitti · N pano çizdi"); Çizim'de okunan pano kesik, yazılan pano dolu çerçeve ve Codex
  imleci (`codexYeri`); yeni pano yazılırken içeriği akar (K-077), güncellenen pano parlar. Panel `hal` `ayrinti` taşır.
- Çöp (K-032, `#/cop`): kaldırılan alan ve çalışma alanları `sayfalar/.cop/kaldirilanlar.json`, Defter'leri yanında; geri yükle
  ya da kalıcı sil (`/api/cop`, `/api/cop-geri`, `/api/cop-sil`).
- Defter'de Codex kutusu (K-033): seçim çubuğunda ✦ Codex, "/" menüsünde Toparla ve Geçmişle değerlendir; kapsam seçilen
  bloklar ya da imlecin bölümü. Sonuç önizlenir: Yerine koy (geri alınır), Altına ekle, "Codex'e söyle" ile düzelttir.
  `/api/codex/yazi` (`yazi_kutusu`: tek tur, luna, bağlam yazı arkadaşıyla aynı, izolasyona uyar).
- Kurulabilir program (K-031): `motor/uygulama/` (manifest, ikonlar, `kapali.html`), servis çalışanı `/sw.js` yalnız sayfa
  açılışında sunucu kapalıysa "Beyin kapalı" der, başka şey önbelleğe almaz. İkonlar `node araclar/ikon-uret.mjs`.
- Tuvalin altında araç çubuğu: Seç, El (H), Sor (C: seçili ya da tıklanan pano Codex'e bağlam olur), Çiz (D: çizim modu),
  + (veri). Codex çalışırken çubukta ne yaptığı yazar; yeni pano gelince tuval ona gider (K-019).
  Seç aracında boşluğu sürüklemek kutu seçer, Shift+tık ekler, ⌘A hepsi; seçili panolar birlikte taşınır. Kutu panoya
  değmezse bölge olur, Sor ile Codex çizeceği panoyu oraya koyar. Dar düzende (⌘\) üst çubuk sol üstte küçük bir düğme.
- Sunucuyu yeniden başlatmadan önce `/api/codex/durum` içindeki `aktif` boş olmalı: başlatma süren Codex turunu keser.
- Çalışma alanı (`calisma.json`): izole bağlam; içinde Claude ve Codex yalnız oradaki notları ve veriyi görür. Varsayılan izole.
- Ortak beyin: ham/, dizin ve şema hiçbir çalışma alanına kilitlenmez; her şey oraya da akar.
- API: `/api/calisma` (GET, POST yeni), `/api/alan` (POST), `/api/izole` (POST), `/api/veri` (GET ?calisma&alan, POST metin|dosya|konu),
  `/api/notlar`, `/api/konusmalar`, `/api/not` (POST: yeni not, konusuz), `/ham/...` (salt okunur).
- Ortak beyin ağı `motor/ag.js`: not → konu, not → pano, nottaki atıf, not → doğduğu konuşma (seçimde görünür).
- Ortak beyin Ağ sekmesi Obsidian grafiği gibi (K-080): tam ekran tek ağ, her düğüm yuvarlak, renk çalışma alanından; arama Enter ile düğüme gider, çalışma alanı süzgeci. Pano yalnız kendi sayfasının alanına bağlanır.
- Çalışma alanı (K-082): raydaki + yanında kart (ad, renk, İzole); menü raydaki kareye sağ tık ya da liste başındaki ▾. Çöp'e taşı soru sormaz, bildirimde Geri al.
- Öğretici sıfırdan kuran için (K-084): boş kurulumda tur Beyin'i öğren'de yürür, Turu geç tanışmaya götürür; 8. ders çalışma alanı ve alan; Codex adımı cevapla sayılır; boş ağda ne yapılacağı yazar.
- Codex (`motor/codex.py`, panel `motor/codex-panel.js`): `codex app-server` sürekli süreç; alan başına bir görev
  (`.durum/codex-gorevler.json`); workspace-write + on-request: repo içinde kendi karar verir, sandbox dışı onay kartı; soru yalnız geri dönüşsüz ya da zevke bağlı işte (K-018).
  `/api/codex/{durum,gecmis,akis,gonder,cevap,dur,modeller}`. Talimat `codex_talimati()`: alan, şema, izole sınırı.
  Gönderirken model ve düşünme seçilir; mesajın önüne etiketli bloklar eklenir (`tur_ekleri()`): `<kullanici>` (ben/),
  `<ilgili_notlar>` (yerel arama), `<cizim_modu>` (açıksa: sormadan çizer), `<pano>` (tuvalde seçilen). Panel ve arşiv
  etiketli blokları kullanıcı mesajı saymaz.
- Ben (`ben/`, hafızanın kimlik klasörü; `motor/hafiza.py`, `/api/ben`): Core.md senin, Kurallar.md düzeltmeler, Last-Session,
  Threads, Journal hafıza sürekliliği. Öğrenilen tercih `knowledge/tercihler/*.md` (`kind: preference`, `validity`); Ben
  sayfasında reddedilen `validity: rejected` olur, bağlama girmez.
- Codex bağlamı (`tur_ekleri()`): `<kullanici>` ben/'den (izole alanda yalnız Core, Kurallar, tercihler), `<ilgili_notlar>`
  `beyin.py context` ile (izole alanda `--project <çalışma alanı>`). Beyin'in Codex oturumlarında hafıza hook'ları kapalı
  (`codex.py` AYAR): bağlamı Beyin verir, bütün beyni getiren tur hook'u izolasyonu delmesin.
- İzolasyon: `.beyin-projects.json` (sunucu `calisma.json`'dan yazar) `notlar/<alan>` ve `ham/kaynaklar/<çalışma alanı>`
  klasörlerini o projeye bağlar; `shared_unscoped: false`.
- Gizli program alanı (`calisma.json` içinde `gizli: true`, şimdilik Beyin › Beyin mimarisi): programın kendi kararları,
  ajanlar tutar. Yan çubukta, ortak beyin ağında, son eklenenlerde ve başka alanların Codex bağlamında görünmez (klasör ve
  `project` süzgeci); Ayarlar'dan (`#/ayarlar`) açılır. Ayarlar ayrıca hafıza sürüm ve sağlık özetini (`/api/hafiza`) ve
  kısayolları gösterir.
- Codex `beyin.py` için geçici JSON'u `.durum/` altına yazar (sandbox içinde, git dışında); `/tmp` onay ister.
- Uçtan uca sınandı (2026-10-03, gerçek Codex turları): açık alanda bütün beyinden bulup çizdi; izole alanda başka alanın
  bilgisini bilmedi; tercih onaysız hafızaya yazıldı; yeni oturum "nerede kalmıştık" sorusunu Last-Session'dan bildi ve
  önceki turda öğrendiği tercihi uyguladı.
- Defter (kodda ve klasörde "sayfa"; K-022, K-029, `motor/sayfalar.py`, düzenleyici `motor/sayfa.js`): alanın ana notu
  `sayfalar/<alan>/<id>.md` (`ana: evet`, `/api/alan-not` yoksa açar), ön bilgi düz, gövde Markdown. Blok düzenleyici ("/"
  menüsü, `# - [] > ``` ---` kısayolları, seçince biçim çubuğu; ⋮⋮ tutamağı sürüklenince blok taşınır, tıklanınca blok
  menüsü), yazdıkça kaydeder; şablonlar "/" menüsünde, imlecin yerine tarihli `##` başlıkla (K-030). hafıza okur, `sayfalar/<alan>` projeye bağlı olduğundan
  izolasyona uyar. Codex alanın görevidir, her mesajda `<sayfa>` bloğu (Defter'in son hali); ⋯ menüsünde "Codex çizsin" tek
  seferlik çizim modlu mesaj. API `/api/sayfa` (GET ?id, POST güncelle), `/api/alan-not`, `/api/sayfalar?alan=`.
- Yazı arkadaşı (K-024): Defter'de yazmayı bırakınca düzenleyici `/api/codex/oneri`'ye sorar: `codex.py` `tek_tur` (ephemeral, salt okunur, luna,
  düşük efor, `outputSchema`), bağlam `<kullanici>`, `<ilgili_notlar>`, `<sayfa>`, `<gecmis_oneriler>`; en çok 3 öneri kenarda
  kart, alıntı CSS Highlight ile işaretli. ⋯ menüsünde "Yazarken öneri" aç/kapa.
- Codex kendiliğinden koşmaz (K-074): zamanlayıcı, açılış işi, dinleme yok; süreç de açılışta ısıtılmaz. Tur yalnız kullanıcının
  eylemiyle ya da o kullanırken arkada bir kez açılır: yazı arkadaşı bir Defter'i program açıkken bir kez okur (`arkadasBakti`),
  yeniden okutmak ⋯ › "Bu nota baksın" (`notaBaktir`, `oneriSimdi`). Yeni Codex işi eklerken bu kurala bak; kendiliğinden tetik
  ekleme. Sınama `node araclar/arkadas-duman.mjs`.
- Tek tık görsel (K-007, K-075): çizen alanın Codex'idir. Yollar: Defter'de "Çizime dök", öneri kartında Çiz, tuvalde hızlı
  eylemler, Codex cevabında Çiz (`[data-mesaj-ciz]`, çizim modu yalnız o mesaj için).
- Veri yorumu (K-026): nota bırakılan dosya veriye girer, notta `[ad](/ham/...)` bağlantısı durur; "/yorumla" ya da ⋯ ile
  Codex nottaki dosya ve linkleri (YouTube: Beyin'in video süreci, `/api/video`) okur, alanın Bilgi'sine "Veri yorumu" yazar
  (Defter'e değil, K-038, K-066), önemlisini çizer. Kurallar `.agents/skills/beyin-veri/SKILL.md`. Beyin'in Codex oturumlarında ağ açık.
- Program kendini geliştirir (K-028): hatalar `.durum/hatalar.jsonl` (`/api/hata`, `/api/hatalar`, Ayarlar'da kart). Yalnız
  Beyin mimarisi alanındaki Codex `motor/`, `araclar/` kodunu düzeltir ve denetler; commit'lemez. `/api/yeniden-baslat`
  (Codex turu sürerken reddeder, sunucu kendini yeniden yükler). Pano denetimi sunucuda: `/api/pano-denetle?ad=`.
- Konuşma arşivi `araclar/arsiv.py`: Stop kancası (`.claude/settings.json`) her turdan sonra Claude ve bu repodaki
  Codex oturumlarını `ham/konusmalar/`a yazar ve yalnız o klasörü commit'ler.

## Katmanlar
| Katman | Yer | Kural |
|---|---|---|
| Ham | `ham/konusmalar/`, `ham/kaynaklar/<çalışma alanı>/<alan>/` | Değişmez, yalnız eklenir; ortak, izole değil |
| Görsel | `panolar/*.dc.html`, `panolar/canvas.json` | Alan = tuvalde bir sayfa; pano biçimi `PANO.md` |
| Not | `notlar/<alan>/*.md` | Panonun bir bölümüne iğnelenir; sunucu `/api/notlar` ile verir. Klasör ilk notla açılır |
| Defter | `sayfalar/<alan>/<id>.md` (`ana: evet`) | Alanın elle yazılan tek notu (Notion benzeri); alanın projesine bağlı |
| Ben | `ben/Core.md`, `ben/Kurallar.md`, `knowledge/tercihler/` | Seni tanıyan katman; her mesajda Codex'e gider |
| Şema | `BEYIN.md` | Bu dosya |
| Bilgi | `knowledge/` (kavram, bağlantı, `tercihler/`), `tasks/`, `daily/v3/` | hafıza; ajan yazar, receipt bağlar |
| Dizin | hafıza SQLite, vault dışında (`.beyin-runtime.json` gösterir, git dışında) | Silinirse `beyin.py sync` dosyalardan kurar |

## Not
Dosya adı `<no>-<kısa-ad>.md`. Üst bilgi:
```
no: K-001            # K karar, S soru, I ilke, R kaynak; alan içinde tekil; iğnede kısa kodu (K1) görünür
id: <alan>-K-001     # hafıza kayıt kimliği, vault içinde tekil
supersedes: [<alan>-K-003]   # yalnız bir kararın yerini alan notta; eskisi aramaya girmez
tur: karar           # karar | soru | ilke | kaynak
baslik: …
pano: BeyinMimari.dc.html  # boşsa not kabukla ilgili, iğnesi yok
bolum: Katmanlar     # panoda aria-label'ı bu olan bölüm; iğne orada durur
veren: kullanici     # kullanici | claude-varsayim | codex
durum: verildi       # acik | verildi | vazgecildi
tarih: 2026-10-02
akis: 3              # alan içinde konuşma sırası
konusma: 2026-10-02-<oturum>   # ham/konusmalar/ altındaki kayıt
```
Gövde: ilk paragraf kararın kendisi; sonra `**Neden:**`, `**Söz:**` (kullanıcının kendi cümlesi, özetlenmez,
yalnız yazım düzeltilir), `**Seçilmeyen:**`.

- Not, karar verildiği turda yazılır. Claude'un kendi varsayımı `veren: claude-varsayim`; kullanıcı değiştirebilir.
- Bir karar öncekini değiştirirse eskisi silinmez: `durum: vazgecildi` ve gövdeye yeni kararın numarası; yeni nota
  `supersedes: [<eskinin id>]` (hafıza eskisini bağlama sokmaz).
- Kaynak notu (`tur: kaynak`) `kaynak:` satırında bağlantıyı taşır; canlı belge kopyalanmaz, ara ara okunur.
- Vazgeçilen not iğne olmaz ve Defter'in altındaki listeye girmez; dosyası kalır, kararın nasıl değiştiği oradan okunur.
- Codex'e hiç gitmemesi gereken not `visibility: private` taşır (hafıza kuralı). Konuşma arşivi
  (`ham/konusmalar/`) hep private: ham kayıttır, hafıza değil; kalıcı olan nota damıtılır.

## Görünüş
Renkler yalnız `panolar/tema.css`'te token (açık, sıcak; mercury-clair zemini). Pano renk yazmaz, `var(--…)` kullanır.
Kabuk Notion çizgisinde, kalabalık yok (K-023): `.kabuk` kapsamındaki tokenlar (beyaz sayfa, açık gri kenar çubuğu, sessiz gri
yazı), tek satırlı öğeler, kutusuz ikon, hayalet düğme, kart yerine satır, başlık altında alt çizgili sekme; açıklama kalıcı
kutuda değil `title` ipucunda. Yeni ekran eklerken bu dile uy: önce neyi kaldırabileceğine bak.
Ekran haritası (K-040): programın her ekranı Beyin mimarisi tuvalinde R1-R14 referans panosu (`Ref*.dc.html`), haritası ve
bulguları 2.1 `EkranHaritasi.dc.html`. Kalıbı değiştiren arayüz işi önce 2.x asıl panosunda çizilir, onaylanınca kodlanır.
Kod değişince `node araclar/ekran-cek.mjs` referansları ve haritanın küçük resimlerini yeniden çeker. Döngünün tamamı repodaki
`beyin-arayuz` skill'inde (`.agents/skills/beyin-arayuz/`); global tuval skill'i kullanılmaz ve değiştirilmez.

## Prototip
`panolar/Prototip.dc.html` (2.0) programın bitmiş hâli, tıklanabilir; tam ekran http://127.0.0.1:4700/tek.html?pano=Prototip.dc.html.
Kod bu deneyime göre yazılır; prototip değişince önce o güncellenir.

## Sırada
Bitti (2026-10-03): konuşma arşivi, ortak beyin ağı, alan paneli ve konu sayfası, Codex paneli (görev, onay, soru),
Ben katmanı ve tur bağlamı, çizim modu ve tuval araç çubuğu, Defter (Notion benzeri not), yazı arkadaşı, veri yorumu,
programın kendini geliştirmesi. 2026-10-04: sade iskelet (K-029).
1. Codex imleci tuvalde: Codex mesajındaki pano › bölüm imleci oraya götürür; soru baloncuğu bölümün yanında.
2. ~~Dinleme~~: yapılmayacak (K-074: Codex kendiliğinden konuşmaz).
3. İğneler tuvalin kendisinde (canlı panonun üstünde, `bolum` ile).
4. Konu çıkarma: Claude konuşmadan başlık verir, iğnelenen konusuz notlara konu önerir.
5. claude.ai içeri al / dışarı ver (tek tık görseli Codex çiziyor, K-075).
6. Damıtma.
