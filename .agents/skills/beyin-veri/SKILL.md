---
name: beyin-veri
description: Beyin'de bir notun ya da konunun verisini okuyup yorumlama (CSV, tablo, PDF, görsel, metin, web linki, YouTube videosu). Kullanıcı "verileri yorumla", "bu dosyalara bak", "bu videoyu incele" dediğinde ya da notta veri bağlantıları varken yorum istediğinde kullan. Sonuç Beyin'e yazılır (not, ham/kaynaklar, hafıza), başka yere değil.
---

# Veri yorumu (Beyin, K-026)

Bu skill yalnız bu klasörde yaşar. Video için Beyin'in kendi video sürecini kullanır (K-067); global `watch-youtube`
skill'ine bağlı değildir. Beyin'in yeri Bilgi sayfası, not ve hafıza.

## Kaynaklar nerede

- Notta `[ad](/ham/...)` bağlantıları: dosya repo kökünde `ham/...` yolunda.
- Notta geçen URL'ler (YouTube dahil).
- Konunun klasörü: `ham/kaynaklar/<çalışma alanı>/<alan>/` (Defter sayfasında `ham/kaynaklar/_genel/`).
- İzole çalışma alanında yalnız o alanın klasörü ve notu; başka alanın verisine bakma.

## Okuma

- **CSV/TSV:** `python3` ve `csv` modülü (pandas yok). Satır sayısı, sütunlar, boş değerler, toplam ve ortalama, uç
  değerler, gruplara göre kırılım. Hesabı koddan yap, kafadan sayı uydurma.
- **XLSX:** openpyxl yok; `python3` `zipfile` ile `xl/sharedStrings.xml` ve `xl/worksheets/sheet*.xml` oku.
- **PDF:** `pdftotext -layout dosya.pdf .durum/veri/<ad>.txt`, sonra metni oku.
- **Görsel:** dosyayı görüntü olarak aç ve içeriğini anlat.
- **Web linki:** ağ açık; `curl -sL <url>` ile al, metni çıkar (`.durum/veri/` altına).
- **YouTube:** videoyu Beyin'in video sürecine ver; indirir, transkripti (altyazı ya da yerel whisper) ve 16 kareyi çıkarır,
  özetini Bilgi'nin `## Videolar` bölümüne kendisi yazar:
  ```bash
  curl -s -X POST http://127.0.0.1:4700/api/video -H 'Content-Type: application/json' -d '{"alan":"<alan>","url":"<URL>"}'
  curl -s 'http://127.0.0.1:4700/api/kaynaklar?alan=<alan>'   # videolar[].asama "bitti" olana dek birkaç kez bak
  ```
  Çıktı `ham/kaynaklar/<çalışma alanı>/<alan>/video/<video_id>/`: `transkript.txt` ve `kare-01..16.jpg`; kareleri görüntü
  olarak oku. Video zaten Kaynaklar'daysa yeniden ekleme, çıktıyı oku. Transkript çıkmadıysa bunu söyle, uydurma.

Ara çıktılar `.durum/` altına (git dışı). Ham dosyaları değiştirme: ham katman yalnız eklenir.

## Yazma

1. Alanın Bilgi sayfasına `## Veri yorumu` bölümü (yolu `<yazma_kurali>`'nda; varsa güncelle, ön bilgiyi koru). Defter'e
   yazma: o kullanıcının notu, izinsiz değişiklik turun sonunda geri alınır (K-038, K-066).
   - **Ana bulgular:** sayılarla, en önemlisi önce.
   - **Örüntüler.**
   - **Çelişen ya da aykırı noktalar.**
   - **Ne anlama geliyor:** kullanıcının işine (`<kullanici>`) bağla.
   - **Açık sorular** ve **sonraki adım**.
   Her maddenin sonunda kaynağı: `(kaynak: dosya.csv)` ya da `(video 03:12)`. Çıkarımı olgu gibi yazma; emin değilsen söyle.
2. Çizim modu açıksa en önemli bulguyu panoya çiz (biçim `PANO.md`, notun tuval sayfasına).
3. Kalıcı bir öğrenim varsa (konu ya da kullanıcı hakkında) hafıza knowledge notu (`beyin.py note-create`); sır yazma.
4. Cevabın kısa olsun: neyi okuduğunu ve en önemli bulguyu bir iki cümleyle söyle.
