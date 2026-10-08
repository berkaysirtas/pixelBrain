// Kimlik ve kurulabilir program duman sınaması (K-031): node araclar/kimlik-duman.mjs (sunucu açıkken). Headless.
// PWA dosyaları, kenar çubuğu avatarları, Defter ikonu ve seçici, renk, alanı ve çalışma alanını kaldırma; geçici alanla.
import { chromium } from 'playwright';
import { rmSync, existsSync } from 'node:fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const { ca, alan, temizle } = await geciciAlan('Kimlik deneme', 'Kimlik alanı');
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
await s.addInitScript(() => { localStorage.setItem('beyin:oneri', 'kapali'); localStorage.setItem('beyin:yan', 'genis'); });
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 160); } };
let notId = '';

await adim('pwa', async () => {
  const m = await (await fetch(KOK + '/uygulama/manifest.webmanifest')).json();
  const kod = async (u) => (await fetch(KOK + u)).status;
  return { ad: m.name, ikon: m.icons.length, sw: await kod('/sw.js'), kapali: await kod('/uygulama/kapali.html'), svg: await kod('/uygulama/ikon.svg'), yok: await kod('/uygulama/../sunucu.py') };
});
await adim('kenar', async () => {
  await s.goto(`${KOK}/#/c/kisisel/satis/yazi`); await s.waitForSelector('#syYazi .sy-baslik'); await s.waitForTimeout(500);
  return { ray: await s.$$eval('#rayListe .ray-kare', (e) => e.map((x) => x.textContent.trim())), alan: await s.$$eval('#calismalar .agac-satir .av, #calismalar .agac-satir .renk-kare', (e) => e.length),
    secili: await s.$eval('#calismalar .agac-satir[aria-current="true"]', (e) => getComputedStyle(e).backgroundColor), sw: await s.evaluate(async () => (await navigator.serviceWorker.ready).scope) };
});
await adim('defter_ikonu', async () => {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/yazi`);  // aynı belge: önceki Defter sökülüp yenisi kurulana kadar bekle
  await s.waitForFunction(() => document.querySelector('#yol')?.textContent.includes('Kimlik alanı') && document.querySelector('#syYazi .sy-ikon'));
  notId = await s.$eval('.sy-yuzey', (e) => e.dataset.not);
  const once = await s.$eval('.sy-ikon', (e) => e.className);
  await s.click('.sy-ikon', { force: true }); await s.waitForSelector('#kimlikSec:not([hidden]) [data-ikon-ciz]');
  // Çizdir gerçek Codex turu açmaz (K-085: her sınama koşusu kotadan yiyordu); istek yakalanır, gövdesi denetlenir
  let istek = null;
  await s.route('**/api/ikon-ciz', (r) => { istek = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: 'application/json', body: '{"sonuc":true}' }); });
  await s.fill('#ksTarif', 'hedef tahtası'); await s.click('#kimlikSec [data-ikon-ciz]'); await s.waitForTimeout(600);
  await s.unroute('**/api/ikon-ciz');
  // pixel art çizimi: ızgara keskin SVG'ye döner, satırdaki aynı renkler tek dikdörtgen
  const svg = await s.evaluate(() => { const d = document.createElement('div'); d.innerHTML = pxSvg(['kkkkkkkkkkkk', ...Array(10).fill('kaaaabbbccck'), 'kkkkkkkkkkkk'], 'mavi', 24); return d.querySelectorAll('rect').length; });
  await s.keyboard.press('Escape'); await s.mouse.click(700, 500);
  return { once, dugme: await s.$eval('.sy-ikon', (e) => e.textContent), istendi: istek?.tarif === 'hedef tahtası' && istek?.calisma === ca, svgDikdortgen: svg, yol: await s.$eval('#yol', (e) => e.textContent) };
});
await adim('renk', async () => {
  await s.hover(`#rayListe [data-git="#/c/${ca}"]`); await s.waitForTimeout(300);
  await s.click(`#lyUst [data-kimlik="ca:${ca}"]`); await s.waitForSelector('#kimlikSec [data-renk]');
  await s.click('#kimlikSec [data-renk="mavi"]'); await s.waitForTimeout(500);
  await s.keyboard.press('Escape'); await s.mouse.click(700, 500);
  return { ray: await s.$eval(`#rayListe [data-git="#/c/${ca}"]`, (e) => e.getAttribute('style')), kapandi: await s.$eval('#kimlikSec', (e) => e.hidden) };
});
await adim('alan_kaldir', async () => {
  await s.click('#syUc'); const d = await s.$('[data-alan-kaldir]');
  await d.click(); const soru = await d.textContent(); await d.click(); await s.waitForTimeout(1200);
  const c = await (await fetch(KOK + '/api/calisma')).json();
  return { soru, adres: new URL(s.url()).hash, kalanAlan: c.calisma_alanlari.find((x) => x.id === ca)?.alanlar.length, copte: existsSync(new URL(`../sayfalar/.cop/${notId}.md`, import.meta.url)) };
});
await adim('calisma_kaldir', async () => {
  await s.hover(`#rayListe [data-git="#/c/${ca}"]`); await s.waitForTimeout(300);
  await s.click(`#lyUst [data-kimlik="ca:${ca}"]`); await s.waitForSelector('#kimlikSec [data-calisma-kaldir]');
  // K-082: tek tık, soru yok; bildirimde Geri al
  await s.click('#kimlikSec [data-calisma-kaldir]'); await s.waitForSelector('#bildirim.acik.eylemli', { timeout: 5000 }); await s.waitForTimeout(800);
  const c = await (await fetch(KOK + '/api/calisma')).json();
  return { adres: new URL(s.url()).hash, yok: !c.calisma_alanlari.some((x) => x.id === ca), geri_al: await s.$eval('#bildirim button', (b) => b.textContent) };
});
await t.close();
temizle();
if (notId) rmSync(new URL(`../sayfalar/.cop/${notId}.md`, import.meta.url), { force: true });
// Kaldırma adımları çöpe kayıt bırakır: bu geçici çalışma alanınınkileri kalıcı sil (kullanıcının çöpüne dokunmaz)
for (const k of (await (await fetch(KOK + '/api/cop')).json()).kayitlar.filter((x) => x.calisma === ca || x.bilgi?.id === ca))
  await fetch(KOK + '/api/cop-sil', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ no: k.no }) });
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
