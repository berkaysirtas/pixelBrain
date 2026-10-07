// Duman sınamaları için geçici çalışma alanı: sunucu API'siyle açar, temizle() ile çalışma alanını, hafıza proje eşlemesini,
// tuval sayfasını, video ve doğrulama kayıtlarını ve klasörlerini (notlar, sayfalar, ham/kaynaklar) kaldırır. Kullanıcının verisine dokunmaz.
import { readFileSync, writeFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
const KOK = 'http://127.0.0.1:4700', REPO = new URL('..', import.meta.url);
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const yol = (p) => new URL(p, REPO);
const jsonDegis = (p, f) => { const v = JSON.parse(readFileSync(yol(p), 'utf8')); f(v); writeFileSync(yol(p), JSON.stringify(v, null, 1) + '\n'); };

export async function geciciAlan(caAd, alanAd) {
  const basla = Date.now() - 2000;
  const ca = (await post('/api/calisma', { ad: caAd, ikon_ciz: false })).sonuc;
  const alan = (await post('/api/alan', { calisma: ca, ad: alanAd, ikon_ciz: false })).sonuc;
  const temizle = () => {
    jsonDegis('calisma.json', (c) => { c.calisma_alanlari = c.calisma_alanlari.filter((x) => x.id !== ca); });
    jsonDegis('panolar/canvas.json', (t) => { t.pages = t.pages.filter((x) => x.id !== 'page-' + alan); });
    jsonDegis('.beyin-projects.json', (p) => { for (const k of Object.keys(p.folders)) if (p.folders[k] === ca) delete p.folders[k]; });
    if (existsSync(yol('.durum/videolar.json'))) jsonDegis('.durum/videolar.json', (v) => { v.splice(0, v.length, ...v.filter((x) => x.alan !== alan)); });
    if (existsSync(yol('.durum/dogrulama.json'))) jsonDegis('.durum/dogrulama.json', (v) => { v.splice(0, v.length, ...v.filter((x) => x.alan !== alan)); });
    for (const d of [`notlar/${alan}`, `sayfalar/${alan}`, `ham/kaynaklar/${ca}`]) rmSync(yol(d), { recursive: true, force: true });
    // Sınama turunun sunucu receipt'i (tur_receipt, S-017) kasada kalmasın: yalnız bu alanın ve bu koşunun kaydı
    const kalip = new RegExp(`"event_id": "beyin-${alan}-\\d{14}"`);
    for (const f of existsSync(yol('receipts')) ? readdirSync(yol('receipts')) : []) {
      const p = yol('receipts/' + f);
      if (f.endsWith('.md') && statSync(p).mtimeMs >= basla && kalip.test(readFileSync(p, 'utf8').slice(0, 400))) rmSync(p);
    }
  };
  return { ca, alan, temizle };
}
