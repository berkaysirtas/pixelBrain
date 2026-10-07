// Defter'de Codex kutusu ve çöp duman sınaması (K-032, K-033): node araclar/yazi-duman.mjs (sunucu açıkken; gerçek Codex turu).
// Headless, geçici alanla: "/toparla" kutusu açılır, sonuç gelir, Yerine koy ve Geri al çalışır; seçim çubuğunda ✦ Codex;
// alan kaldırılınca Çöp'te görünür, geri yüklenir; sonunda geçici alan kaldırılır.
import { chromium } from 'playwright';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const { ca, alan, temizle } = await geciciAlan('Yazı deneme', 'Yazı alanı');
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
await s.addInitScript(() => { localStorage.setItem('beyin:oneri', 'kapali'); });
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 200); } };
const govde = async (id) => (await (await fetch(`${KOK}/api/sayfa?id=${id}`)).json()).govde;
let notId = '';

await adim('toparla', async () => {
  const n = await post('/api/alan-not', { alan });
  notId = n.sonuc.id;
  await post('/api/sayfa', { id: notId, title: 'Yazı alanı', govde: '## Klinik görüşmesi\n\nbugün klinikle görüştm fiyatı sordular ben hemen söyledm aslında önce dertlerini sormam lazımdı randevu kaçıyor dediler whatsapptan dönüş geç oluyormuş' });
  await s.goto(`${KOK}/#/c/${ca}/${alan}/yazi`);
  await s.waitForFunction(() => document.querySelector('#yol')?.textContent.includes('Yazı alanı') && document.querySelectorAll('#syYazi .sy-blok').length >= 2);
  await s.click('.sy-bloklar > .sy-blok:nth-child(2) .sy-metin'); await s.keyboard.press('Meta+ArrowRight'); await s.keyboard.press('Enter');
  await s.keyboard.type('/topar', { delay: 8 }); await s.waitForTimeout(200);
  const menu = await s.$$eval('.sy-menu .sy-menu-oge b', (e) => e.map((x) => x.textContent));
  await s.keyboard.press('Enter');
  await s.waitForSelector('.sy-ai .sy-ai-iskelet', { timeout: 5000 });
  const bas = Date.now();
  await s.waitForSelector('.sy-ai .sy-ai-sonuc', { timeout: 120000 });
  return { menu, sure: Math.round((Date.now() - bas) / 1000) + ' sn', kapsam: await s.$$eval('.sy-ai-kapsam', (e) => e.length), sonuc: (await s.$eval('.sy-ai-sonuc', (e) => e.innerText)).slice(0, 240) };
});
await adim('yerine_koy', async () => {
  const once = await govde(notId);
  await s.click('.sy-ai [data-ai="koy"]'); await s.waitForTimeout(1500);
  const sonra = await govde(notId);
  await s.click('.sy-ai [data-ai="geri"]'); await s.waitForTimeout(1500);
  return { degisti: once !== sonra, geriAlindi: (await govde(notId)).includes('görüştm'), kutu: await s.$eval('.sy-ai', (e) => e.hidden) };
});
await adim('secim_cubugu', async () => {
  await s.evaluate(() => { const bl = document.querySelectorAll('.sy-bloklar > .sy-blok .sy-metin'); const r = document.createRange(); r.setStart(bl[0], 0); r.setEnd(bl[1], bl[1].childNodes.length); const x = getSelection(); x.removeAllRanges(); x.addRange(r); });
  await s.waitForTimeout(300);
  const gorunur = await s.$eval('.sy-bicim', (e) => !e.hidden && e.classList.contains('cok'));
  await s.click('.sy-bicim [data-b="codex"]'); await s.waitForTimeout(200);
  return { gorunur, menu: await s.$$eval('.sy-bicim-menu:not([hidden]) b', (e) => e.map((x) => x.textContent)) };
});
await adim('cop', async () => {
  await s.keyboard.press('Escape');
  await post('/api/alan-kaldir', { alan });
  await s.goto(`${KOK}/#/cop`); await s.waitForSelector('.cop-satir'); await s.waitForTimeout(300);
  const satirlar = await s.$$eval('.cop-satir b', (e) => e.map((x) => x.textContent));
  const satir = await s.$(`.cop-satir:has-text("Yazı alanı")`); await satir.hover();
  await (await satir.$('[data-cop-geri]')).click(); await s.waitForTimeout(1200);
  const c = await (await fetch(KOK + '/api/calisma')).json();
  return { satirlar, adres: new URL(s.url()).hash, geriGeldi: c.calisma_alanlari.find((x) => x.id === ca)?.alanlar.some((a) => a.id === alan), defter: (await govde(notId)).includes('Klinik') };
});
await t.close();
temizle();
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
