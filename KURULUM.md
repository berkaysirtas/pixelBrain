# pixelBrain kurulum rehberi (ajan için)

Bu belgeyi Codex, Claude Code ya da başka bir kodlama ajanı okuyor ve kullanıcının açtığı klasöre **pixelBrain**'i (uygulama
içindeki adıyla Beyin) kuruyor. Adımları sırayla izle, her adımın sonucunu kontrol et, sonunda kullanıcıya kısa bir özet ver.
Kullanıcıyla Türkçe konuş (kullanıcı başka dil kullanıyorsa onun dilinde).

## Değişmez kurallar

- Kullanıcının var olan hiçbir dosyasını silme, taşıma ya da üstüne yazma. Kurulum betiği de yazmaz: yalnız eksikleri ekler.
- `sudo` kullanma, sistem ayarı değiştirme, kullanıcıdan parola ya da token isteme.
- Program dosyalarını elle düzenleme; güncelleme ve onarım betiklerle yapılır.
- Bir adım başarısız olursa uydurma "kuruldu" deme: hatanın son satırlarını göster ve ne gerektiğini söyle.

## 1. Ortamı kontrol et

```sh
uname -s                      # Darwin olmalı (macOS). Linux'ta sınanmadı, Windows desteklenmiyor: kullanıcıya söyle.
python3 --version             # 3.11 ya da üstü
command -v node npm codex     # node/npm isteğe bağlı (pano küçük resimleri); codex Beyin'in yapay zekâsı için gerekli
```

- Python 3.11'den eskiyse dur ve kullanıcıya söyle: `brew install python@3.12` ya da https://www.python.org/downloads/
- `codex` yoksa kuruluma devam et ama sonunda söyle: `npm install -g @openai/codex`, ardından `codex login`.
- Node.js yoksa devam et; sonunda küçük resimler için https://nodejs.org önerisini ekle.

## 2. Hedef klasörü seç

Hedef, kullanıcının seni açtığı klasör (`pwd`). Klasör boşsa ya da bir not klasörüyse (ör. Obsidian kasası) oraya kur.
Klasör ev klasörünün kendisi, Masaüstü'nün kökü ya da başka bir yazılım projesiyse (ör. `package.json`, `.git` ve kaynak kod
var) oraya kurma; kullanıcıya `pixelBrain` adında bir alt klasör öner ve onay alınca orada devam et.

## 3. Kur

```sh
curl -fsSL https://raw.githubusercontent.com/berkaysirtas/pixelBrain/main/kur.sh | sh -s -- "$PWD"
```

Betik son sürümü indirir, eksik dosyaları ekler, hafıza katmanını kurar (`ben/` kimlik klasörü dahil) ve Node.js varsa
pano küçük resimleri için tarayıcı motorunu kurar.

İzin notu: bu komut internete çıkar ve klasör dışında iki yere yazar: hafıza dizini
`~/Library/Application Support/beyin-v3/` ve (Node.js varsa) `~/.npm`, `~/Library/Caches/ms-playwright`. Sandbox'ta
çalışıyorsan bu komut için kullanıcıdan izin iste (Codex'te onay, Claude Code'da izin istemi). İzin verilmezse kullanıcıya
komutu kendisinin çalıştırmasını öner.

Hata olursa: `tail -5 .durum/hafiza-kurulum.log` çıktısını göster.

## 4. Doğrula

```sh
test -f program.json && test -f .beyin-version && test -d ben && echo "dosyalar tamam"
python3 -c "import json; print('pixelBrain', json.load(open('program.json'))['surum'])"
python3 beyin.py doctor --human        # ilk kurulumda "henuz dogrulanmadi" satırları normaldir
python3 motor/guncelle.py kontrol      # "Beyin güncel" beklenir
```

## 5. Aç

macOS'ta `open "Beyni Aç.command"` (Terminal'de kısa bir pencere açar, Beyin'i arka planda başlatır ve tarayıcıda
http://127.0.0.1:4700 adresini açar). Sandbox bunu engellerse kullanıcıya klasördeki **Beyni Aç** dosyasına çift tıklamasını
söyle. Sunucuyu kendi oturumunda ön planda başlatma (`./baslat.sh` turu kilitler); gerekirse arka planda başlat:
`nohup ./baslat.sh > .durum/sunucu.log 2>&1 &`. Port 4700 doluysa aynı komutun başına `PORT=4710 ` ekle; adres
http://127.0.0.1:4710 olur.

Açıldı mı: `curl -s http://127.0.0.1:4700/api/surum` bir JSON döndürmeli.

## 6. Kullanıcıya söyle

Kısa bir özet ver: kurulan sürüm, klasör ve şunlar:

1. **İlk tur** Beyin'i ilk açışta kendiliğinden başlar; son adımda Beyin onu tanımak için birkaç soru sorar.
2. **Codex girişi:** Beyin'deki yapay zekâ Codex'le çalışır. `codex login` yapılmadıysa Codex paneli çalışmaz.
3. **Hook güveni:** bu klasörü Claude Code ya da Codex ile açınca istemci hafıza hook'larına güvenmeni ister; Codex'te
   `/hooks` ekranından incelenip onaylanır. Bu güveni kullanıcı verir, sen veremezsin.
4. **Güncelleme:** Beyin'de Ayarlar › Program › Sürüm › "Güncellemeleri kontrol et" ve "Güncelle". Notlar, panolar ve hafıza
   güncellemede değişmez.
5. Eksik olan varsa (Codex, Node.js) tek satırla nasıl kurulacağı.

## Sonradan lazım olanlar

| İş | Komut (Beyin klasöründe) |
|---|---|
| Yeni sürüm var mı | `python3 motor/guncelle.py kontrol` |
| Güncelle | `python3 motor/guncelle.py kur` (açık Beyin'i sonra yeniden başlat) |
| Son güncellemeyi geri al | `python3 motor/guncelle.py geri` |
| Onar (eksik dosyaları tamamla) | `sh kur.sh` |
| Hafıza sağlığı | `python3 beyin.py doctor --human` |
| Video araçları (isteğe bağlı) | `sh araclar/video-kur.sh` (ffmpeg gerekir: `brew install ffmpeg`) |
| Hafıza bağlantılarını kaldır | `python3 hafiza/scripts/install_v3.py --vault "$PWD" --uninstall` (notlar kalır) |
