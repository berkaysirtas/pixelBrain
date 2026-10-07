---
visibility: private
kind: instruction
---
# Pano biçimi (.dc.html)

Panolar `panolar/` altında; sunucu `/project/<dosya>` olarak verir, motor `motor/dc-runtime.js` (`/project/support.js`).
Her pano kendi başına çizilir ve başka panoya `dc-import` ile girer. Doğrula: `node araclar/pano.mjs <Pano.dc.html>`
(sayfa hatası, çözülmemiş alan, taşma; görüntü `.durum/pano/`).

Codex çizim turunda panoyu dosyaya yazmaz: cevabında `<pano-yaz ad= baslik= w= h=>` bloğuyla yalnız gövdeyi (`<helmet>` ve kök
`<div>`) verir, Beyin akarken tuvale çizer ve aşağıdaki iskelete sarıp dosyayı yazar (K-077; tarif mesajla gelir). Etkileşimli
pano (durum, tıklama, `dc-import`) dosyaya bu iskeletle yazılır. Codex'in içerik panoları stil yazmaz, `pano-kit.css` sınıflarını
kullanır (K-078, örnek `PanoKit.dc.html`).

## İskelet
```html
<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Ad</title><script src="./support.js"></script></head>
<body><x-dc>
<helmet><link rel="stylesheet" href="./tema.css"> yazı tipi linki, <style> sınıflar </style></helmet>
<div style="width: 1440px; height: 900px; background: var(--zemin); …">…işaretleme…</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"hal":{"editor":"enum","options":["a","b"],"default":"a"},"$preview":{"width":1440,"height":900}}'>
class Component extends DCLogic {
  constructor(props) { super(props); this.state = { hal: props.hal ?? 'a' }; }
  renderVals() { return { baslik: 'X', sec: () => this.setState({ hal: 'b' }) }; }
}
</script></body></html>
```

## Kurallar
- Renk yalnız `var(--…)` (panolar/tema.css). Ham onaltılık renk yazılmaz.
- `{{alan}}` metin, öznitelik ve stil içinde; `<sc-for list="{{x}}" as="o">`, `<sc-if value="{{k}}">`; tıklama `onClick="{{f}}"`.
- Alt bileşen: `<dc-import name="CodexPanel" hal="sohbet" boy="{{ 800 }}" hint-size="420px,800px">`; sayı ve nesne prop'u `{{ }}` ile.
- Veri sunucudan: `/api/notlar`, `/api/konular`, `/api/calisma`; panoda elle liste tutulmaz.
- Not iğnesi: panodaki bölümün `aria-label`'ı notun `bolum`u ile aynı; iğne notun kısa kodunu taşır (K-001 → K1).
- Aynı parça üçüncü kez elle yazılıyorsa ortak bileşene çıkar (CodexPanel gibi).

## Tuzaklar
- `renderVals` dönüşünde aynı adı taşıyan iki alan React "object as child" hatası verir; adlar tekil.
- Metin kutusu: `defaultValue="{{x}}"`; `<textarea>{{x}}</textarea>` "[object Object]" yazar.
- SVG öznitelikleri (`fill=`, `stroke=`) `var()` çözmez: stile yaz (`style="fill: var(--codex)"`).
- Motor camelCase öznitelikleri metin düzeyinde çevirir; veri adresindeki `viewBox` bozulur, SVG'yi satır içi koy.
- Sabit boylu kök içerik büyüyünce keser: `pano.mjs` TAŞMA derse kökü ve canvas.json `h`'yi büyüt.
