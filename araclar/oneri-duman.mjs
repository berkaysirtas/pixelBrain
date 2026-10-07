// Yazı arkadaşı ve alan notu duman sınaması: node araclar/oneri-duman.mjs (sunucu açıkken; gerçek Codex turu, ~30 sn).
// Headless. Alan ekranı Defter ile açılır mı, Çizim'de alanın panoları var mı (yalnız okur); geçici bir alanın Defter'ine
// yazınca Codex kenara öneri bırakır mı, Uygula metni değiştirir mi. Geçici alan sonunda kaldırılır (araclar/gecici-alan.mjs).
import { chromium } from 'playwright';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700', ALAN = process.argv[2] || '#/c/kisisel/satis';
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 160); } };
await s.addInitScript(() => { localStorage.removeItem('beyin:oneri'); });

await adim('alan_yazi', async () => {
  await s.goto(KOK + '/' + ALAN); await s.waitForSelector('#syYazi .sy-baslik', { timeout: 15000 });
  return { baslik: await s.$eval('.sy-baslik', (e) => e.textContent), sekme: await s.$eval('[data-sy-sekme="yazi"]', (e) => e.getAttribute('aria-selected')),
    yol: await s.$eval('#yol', (e) => e.textContent) };
});
await adim('alan_cizim', async () => {
  await s.click('[data-sy-sekme="cizim"]'); await s.waitForSelector('#syCizim iframe', { timeout: 15000 }); await s.waitForTimeout(2000);
  return { pano: await s.frameLocator('#syCizim iframe').locator('.pano').count(), bos: await s.$eval('#syCizimBos', (e) => !e.hidden), url: new URL(s.url()).hash };
});
const { ca, alan, temizle } = await geciciAlan('Öneri deneme', 'Öneri alanı');
let id = '';
await adim('oneri', async () => {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/yazi`); await s.waitForSelector('#syYazi .sy-blok .sy-metin', { timeout: 15000 });
  id = await s.$eval('.sy-yuzey', (e) => e.dataset.not);
  await s.click('.sy-blok .sy-metin');
  await s.keyboard.type('İlk klinik görüşmesinde fiyatı hemen söylüyorum, kliniğn derdini sonra soruyorum. Randevu kaçağı en büyük sorun gibi duruyo ama emin değilim.', { delay: 4 });
  const bas = Date.now();
  await s.waitForSelector('.sy-oneri', { timeout: 90000 });
  const kartlar = await s.$$eval('.sy-oneri', (e) => e.map((x) => x.dataset.tur + ': ' + x.querySelector('.sy-oneri-yeni, .sy-oneri-soru')?.textContent.slice(0, 80)));
  const isaret = await s.evaluate(() => (CSS.highlights?.get('codex-oneri')?.size) || 0);
  return { sure: Math.round((Date.now() - bas) / 1000) + ' sn', kartlar, isaret };
});
await adim('uygula', async () => {
  const kart = await s.$('.sy-oneri[data-tur="degistir"]');
  if (!kart) return 'degistir önerisi yok';
  const once = await s.$eval('.sy-blok .sy-metin', (e) => e.textContent);
  await kart.$eval('[data-e="uygula"]', (b) => b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  await s.waitForTimeout(1500);
  const sonra = await s.$eval('.sy-blok .sy-metin', (e) => e.textContent);
  const kayit = await (await fetch(KOK + '/api/sayfa?id=' + id)).json();
  return { degisti: once !== sonra, kayitta: kayit.govde === sonra.trim() || kayit.govde.includes(sonra.slice(0, 30)), kalanKart: await s.$$eval('.sy-oneri', (e) => e.length) };
});
await t.close();
temizle();
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
