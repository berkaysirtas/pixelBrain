# pixelBrain bulutta açık

1. **pixelBrain sekmesi** kendiliğinden açılır. Açılmadıysa alttaki **Ports** sekmesinde `4700 (pixelBrain)` satırındaki
   küre simgesine bas.
2. **Codex'e giriş (bir kez):** alttaki terminale yaz:

   ```
   codex login --device-auth
   ```

   Ekrandaki kodu açılan sayfada onayla (ChatGPT hesabınla). Sonra pixelBrain'de Codex paneline yaz.

Bilmen gerekenler:

- Sayfa yalnız sana açık (GitHub girişi ister). Ports sekmesinde portu **Public** yapma: notların herkese açılır.
- Ücretsiz kota: kişisel GitHub hesabında ayda 120 çekirdek saati (bu makineyle 60 saat) ve 15 GB. Kullanmayınca codespace
  30 dakikada durur, kota harcamaz; durunca pixelBrain de kapanır, yeniden açınca kendiliğinden başlar.
- **Verin bu codespace'te.** GitHub, 30 gün açılmayan codespace'i siler. Saklamak için ara ara klasörü indir (Explorer'da
  sağ tık › Download) ya da kendi bilgisayarına kur: README › Kurulum.
- Sunucu kaydı: `.durum/codespace.log`. Yeniden başlatmak: `sh .devcontainer/ac.sh`.
