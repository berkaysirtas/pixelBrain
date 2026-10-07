// Codex'in canlı geri bildirimi duman sınaması (K-034, K-039): node araclar/canli-duman.mjs (sunucu açıkken). Headless, geçici alanla.
// Codex turu taklit edilir (notHal): panel kapalıyken baloncuğun yanında ne yaptığı, bitince "Bitti". Çizim'de taslak yok:
// okunan pano kesik çerçeve ve "Codex okuyor", yazılan pano dolu çerçeve ve "Codex yazıyor", tur bitince söner.
// Bilgi'ye yazınca yeni blok vurgulanır ve "Codex yazdı" etiketi çıkar.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700', yol = (p) => new URL('../' + p, import.meta.url);
const { ca, alan, temizle } = await geciciAlan('Canlı deneme', 'Canlı alanı');
const PANO = 'CanliDeneme' + alan.replace(/[^a-z0-9]/gi, '') + '.dc.html';
const tuvalDegis = (f) => { const t = JSON.parse(readFileSync(yol('panolar/canvas.json'), 'utf8')); f(t); writeFileSync(yol('panolar/canvas.json'), JSON.stringify(t, null, 1) + '\n'); };
writeFileSync(yol('panolar/' + PANO), '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<title>Canlı deneme</title>\n</head>\n<body style="font-family:sans-serif;padding:40px"><h1>Canlı deneme</h1></body>\n</html>\n');
tuvalDegis((t) => { t.boards[PANO] = { x: 0, y: 0, w: 900, h: 600, title: 'Canlı deneme', page: 'page-' + alan }; });
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
await s.addInitScript(() => { localStorage.setItem('beyin:oneri', 'kapali'); localStorage.setItem('beyin:panel', 'kapali'); });
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 200); } };
const hal = (h) => s.evaluate((x) => notHal(x), h);

await adim('defter_baloncuk', async () => {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/yazi`);
  await s.waitForFunction(() => document.querySelector('#yol')?.textContent.includes('Canlı alanı') && document.querySelector('#codexSoz'));
  await hal({ calisiyor: true, is: 'Okuyor', ayrinti: 'PANO.md, canvas.json' }); await s.waitForTimeout(150);
  const calisirken = await s.$eval('#codexSoz', (e) => !e.hidden && e.className + ' | ' + e.textContent);
  await hal({ calisiyor: true, is: 'Dosya yazıyor', yazdi: ['panolar/Deneme.dc.html'] });
  await hal({ calisiyor: false, is: '' }); await s.waitForTimeout(150);
  return { calisirken, bitti: await s.$eval('#codexSoz', (e) => !e.hidden && e.textContent), ustCubukta: await s.$$eval('#ustEk .sy-durum', (e) => e.length) };
});
await adim('cizim_gercek', async () => {
  await s.click('[data-sy-sekme="cizim"]'); await s.waitForSelector('#syCizim iframe'); await s.waitForTimeout(1800);
  const f = s.frameLocator('#syCizim iframe'), pano = f.locator(`.pano[data-pano="${PANO}"]`);
  const durum = async () => ({ sinif: (await pano.getAttribute('class')).split(' ').filter((x) => x.startsWith('codex-')).join(' '),
    imlec: await f.locator('.codex-imlec').evaluateAll((e) => e.filter((x) => !x.hidden).map((x) => x.textContent)) });
  await hal({ calisiyor: true, is: 'Düşünüyor', ciz: true }); await s.waitForTimeout(250);
  const dusunurken = { taslak: await f.locator('.hayalet').count(), ...(await durum()) };
  await hal({ calisiyor: true, is: 'Okuyor', ayrinti: PANO + ', PANO.md', ciz: true }); await s.waitForTimeout(250);
  const okurken = await durum();
  await hal({ calisiyor: true, is: 'Dosya yazıyor', ayrinti: PANO, ciz: true }); await s.waitForTimeout(250);
  const yazarken = await durum();
  await hal({ calisiyor: false, is: '', ciz: true }); await s.waitForTimeout(1500);
  return { dusunurken, okurken, yazarken, sonra: await durum(), baloncukGizli: await s.$eval('#codexSoz', (e) => e.hidden) };
});
await adim('bilgi_vurgu', async () => {
  await s.click('[data-sy-sekme="bilgi"]'); await s.waitForSelector('#syBilgi .bl-baslik2'); await s.waitForTimeout(500);
  const b = (await (await fetch(KOK + '/api/alan-bilgi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alan }) })).json()).sonuc;
  await s.evaluate(() => bilgiCiz()); await s.waitForTimeout(400);
  await fetch(KOK + '/api/sayfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, govde: '## Özet\n\nCodex bu satırı az önce yazdı.' }) });
  await hal({ calisiyor: true, is: 'Dosya yazıyor', yazdi: [`sayfalar/${alan}/${b.id}.md`] }); await s.waitForTimeout(700);
  await hal({ calisiyor: false, is: '' });
  return { yeni: await s.$$eval('#syBilgi .bl-yeni', (e) => e.map((x) => x.textContent.replace('Codex yazdı', '').replace("Defter'e al", '').trim())), etiket: await s.$$eval('#syBilgi .bl-codex', (e) => e.length) };
});
await t.close();
tuvalDegis((t) => { delete t.boards[PANO]; }); rmSync(yol('panolar/' + PANO), { force: true });
temizle();
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
