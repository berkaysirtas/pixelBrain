# Güvenlik

pixelBrain yalnız kendi bilgisayarında, `127.0.0.1` adresinde çalışır; notların klasöründe kalır.
GitHub Codespaces'te ise codespace'in özel adresinden açılır; o adresi yalnız sen görürsün (GitHub girişi). pixelBrain'de
giriş ekranı yoktur: Ports sekmesinde portu **Public** yaparsan notların ve Codex'in herkese açılır.

Bir güvenlik açığı bulduysan herkese açık issue açma. GitHub'daki
[gizli bildirim formunu](https://github.com/berkaysirtas/pixelBrain/security/advisories/new) kullan. Bildirime sürümü,
açığın nasıl tetiklendiğini ve etkisini yaz; kişisel notlarını ya da tokenlarını ekleme.

Özellikle ilgilendiğimiz konular: başka bir sitenin tarayıcın üzerinden yerel sunucuya istek atabilmesi, güncellemenin
program dosyaları dışına yazabilmesi, izole çalışma alanında Codex'in başka alanların dosyalarını okuyabilmesi.

Desteklenen sürüm: yalnız en son sürüm. Düzeltmeler uygulamanın içinden güncellemeyle gelir.
