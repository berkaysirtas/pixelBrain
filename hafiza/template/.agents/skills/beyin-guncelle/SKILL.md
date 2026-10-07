---
name: beyin-guncelle
description: Beyin'i ve hafıza katmanını yeni sürüme güncelle, sürümü kontrol et veya son güncellemeyi geri al. Beynimi güncelle, yeni sürüm var mı ve geri al isteklerinde kullan.
---

# Beyni güncelle

Beyin ve hafıza katmanı birlikte güncellenir. Tek araç vault kökündeki `motor/guncelle.py` dosyasıdır; aynı iş Beyin'de
Ayarlar › Program › Sürüm kartından yapılır. macOS/Linux'ta `python3`, Windows'ta `py -3` kullan. Kendi curl/copy/git-pull
zincirinle kullanıcı vault'unu güncelleme.

- Kullanıcı yalnız sürüm soruyorsa `python3 motor/guncelle.py kontrol` çalıştır; kurulum yapma.
- Kullanıcı güncellemeyi istiyorsa `python3 motor/guncelle.py kur` çalıştır. Bu istek rutin yerel güncelleme için
  yetkilendirmedir; ikinci kez izin isteme. `python3 beyin.py update` de aynı yere gider.
- Kullanıcı geri dönmek istiyorsa `python3 motor/guncelle.py geri` çalıştır; ardından `python3 beyin.py doctor` ile sonucu doğrula.
- Başlangıç skill'lerini, adaptörleri veya başlatıcıları susturma/açma isteklerinde `python3 beyin.py preferences --exclude-component <ad>`
  veya `--include-component <ad>` çalıştır.

Güncelleyici yalnız program dosyalarını değiştirir: notlar, sayfalar, panolar, ben/, knowledge/ ve ayarlar güncelleme metni değildir,
hiç dokunulmaz. Kullanıcının elle değiştirdiği program dosyası yenisiyle değişirse eski hâli `.durum/guncelleme/` altında yedeklenir
ve çakışma olarak bildirilir; kullanıcı isterse değişikliğini yeni sürüme taşı. Aynı sürümün no-op olması başarıdır. Yeni sürüm yoksa
ya da erişim yoksa 'güncellendi' deme. Açık Beyin varsa güncellemeden sonra yeniden başlatılması gerektiğini söyle.

Sonuç mesajında önceki→yeni sürümü ve varsa çakışan dosyaları belirt. Token, yerel kullanıcı yolu ya da ham log paylaşma.
