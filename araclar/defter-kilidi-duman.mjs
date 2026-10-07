// Defter kilidi bildirimi duman sınaması (K-066): node araclar/defter-kilidi-duman.mjs (sunucu açıkken). Headless.
// /api/alan-durum'a bir geri alma kaydı eklenir: kabuk "geri aldım" bildirimini bir kez gösterir, yeniden açılınca tekrarlamaz.
import { chromium } from 'playwright';
const KOK = 'http://127.0.0.1:4700';
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
await s.addInitScript(() => { localStorage.setItem('beyin:kurulum', 'bitti'); localStorage.setItem('beyin:oneri', 'kapali'); });
const calisma = await (await fetch(KOK + '/api/calisma')).json();
const alan = calisma.calisma_alanlari.find((c) => !c.gizli && c.alanlar.length).alanlar[0];
const no = Date.now();
await s.route('**/api/alan-durum', async (r) => {
  const cevap = await r.fetch(), d = await cevap.json();
  d.defter_geri = [{ no, alan: alan.id, zaman: Math.floor(no / 1000), dosya: `sayfalar/${alan.id}/s-x.md`, yedek: '.durum/codex-defter/s-x-deneme.md' }];
  await r.fulfill({ response: cevap, json: d });
});
const bildirim = () => s.$eval('#bildirim', (e) => (e.classList.contains('acik') ? e.textContent : ''));
try {
  await s.goto(KOK + '/#/ortak'); await s.waitForSelector('#rayListe .ray-kare', { timeout: 15000 }); await s.waitForTimeout(1500);
  sonuc.ilk = await bildirim();
  await s.reload(); await s.waitForSelector('#rayListe .ray-kare', { timeout: 15000 }); await s.waitForTimeout(1500);
  sonuc.ikinci = await bildirim();
} catch (e) { hatalar.push('HATA: ' + String(e).slice(0, 200)); }
await t.close();
const tamam = sonuc.ilk.includes('geri aldım') && sonuc.ilk.includes(alan.ad) && !sonuc.ikinci.includes('geri aldım');
if (!tamam) hatalar.push('bildirim');
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
