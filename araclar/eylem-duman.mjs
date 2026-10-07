// Tuvalde hızlı eylemler duman sınaması: node araclar/eylem-duman.mjs (sunucu açıkken; Kümele için gerçek Codex turu, ~1-3 dk).
// Headless. Geçici alanın Çizim sayfasına iki küçük pano konur. Tek seçimde çubuk Revize et, Genişlet, Doğrula, Sor; çoklu
// seçimde Kümele, Birleştir, Karşılaştır, Sor gösterir mi; Revize et satır içi istek açar mı; Kümele kabuğa doğru veriyle gider,
// Codex yeni panoyu seçimin sağındaki boş yere çizer mi, seçilen panolar yerinde kalır mı. Sonunda her şey kaldırılır.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700', yol = (p) => new URL('../' + p, import.meta.url);
const hatalar = [], sonuc = {};
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 160); } };
const { ca, alan, temizle } = await geciciAlan('Eylem deneme', 'Eylem alanı');
const sayfa = 'page-' + alan, ek = alan.replace(/[^a-z0-9]/gi, '');
const PANOLAR = [['EylemA' + ek, 'Satış fikirleri', ['Kliniklere ücretsiz denetim teklif et', 'Randevu kaçağını ölç', 'Referans programı kur']],
  ['EylemB' + ek, 'Pazarlama fikirleri', ['Randevu kaçağı üzerine içerik yaz', 'Klinik vaka çalışması yayınla', 'Referans veren kliniğe indirim']]];
const tuvalDegis = (f) => { const t = JSON.parse(readFileSync(yol('panolar/canvas.json'), 'utf8')); f(t); writeFileSync(yol('panolar/canvas.json'), JSON.stringify(t, null, 1) + '\n'); };
PANOLAR.forEach(([ad, baslik, maddeler]) => writeFileSync(yol(`panolar/${ad}.dc.html`), `<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<title>${baslik}</title>\n</head>\n<body style="font-family:sans-serif;padding:40px">\n<h1>${baslik}</h1>\n<ul>${maddeler.map((m) => `<li>${m}</li>`).join('')}</ul>\n</body>\n</html>\n`));
tuvalDegis((t) => PANOLAR.forEach(([ad, baslik], i) => { t.boards[ad + '.dc.html'] = { x: i * 1000, y: 0, w: 900, h: 600, title: baslik, page: sayfa }; }));
const ilkPanolar = new Set(PANOLAR.map(([ad]) => ad + '.dc.html'));

const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
const govdeler = [];
s.on('request', (r) => { if (r.url().endsWith('/api/codex/gonder')) govdeler.push(JSON.parse(r.postData() || '{}')); });
const tuval = () => s.frameLocator('#syCizim iframe');
const cubuk = async () => tuval().locator('#eylem').evaluate((e) => ({ gorunur: !e.hidden, dugmeler: [...e.querySelectorAll('button')].map((b) => b.textContent.trim()) }));

await adim('tek', async () => {
  await s.goto(`${KOK}/#/c/${ca}/${alan}/cizim`); await s.waitForSelector('#syCizim iframe', { timeout: 15000 });
  await tuval().locator(`.pano[data-pano="${PANOLAR[0][0]}.dc.html"] .serit`).waitFor({ timeout: 15000 });
  await s.waitForTimeout(800);
  await tuval().locator(`.pano[data-pano="${PANOLAR[0][0]}.dc.html"] .serit`).click();
  return await cubuk();
});
await adim('revize_satir', async () => {
  await tuval().locator('#eylem [data-eylem="revize"]').click();
  const giris = await tuval().locator('#eylemIstek').isVisible();
  await tuval().locator('#eylemIstek').press('Escape');
  return { giris, geri: (await cubuk()).dugmeler.length };
});
await adim('coklu', async () => {
  await tuval().locator(`.pano[data-pano="${PANOLAR[1][0]}.dc.html"] .serit`).click({ modifiers: ['Shift'] });
  return await cubuk();
});
let yer = null;
await adim('kumele', async () => {
  await tuval().locator('#eylem [data-eylem="kumele"]').click();
  await s.waitForTimeout(1500);
  const g = govdeler.at(-1) || {};
  yer = g.eylem?.yer;
  const taslak = await tuval().locator('.hayalet').count();  // K-039: taslak yok, yalnız gerçek okuma ve yazma işaretlenir
  const mesaj = await s.$$eval('.cx-sen', (e) => e.map((x) => x.textContent.trim()).at(-1));
  return { metin: g.metin, eylem: g.eylem?.ad, panolar: g.panolar, yer, taslak, mesaj, cubukKapali: (await cubuk()).dugmeler.filter((d) => d !== 'Sor…').length };
});
await adim('codex_cizdi', async () => {
  const bas = Date.now();
  while (Date.now() - bas < 300000) {
    const b = Object.entries(JSON.parse(readFileSync(yol('panolar/canvas.json'), 'utf8')).boards).filter(([ad, v]) => v.page === sayfa && !ilkPanolar.has(ad));
    if (b.length) {
      await s.waitForTimeout(3000);
      const [ad, v] = b[0], t2 = JSON.parse(readFileSync(yol('panolar/canvas.json'), 'utf8')).boards;
      return { sure: Math.round((Date.now() - bas) / 1000) + ' sn', ad, baslik: v.title, yerinde: !!yer && Math.abs(v.x - yer.x) < 200 && Math.abs(v.y - yer.y) < 200, x: v.x, y: v.y,
        eskilerYerinde: PANOLAR.every(([a], i) => t2[a + '.dc.html']?.x === i * 1000) };
    }
    await s.waitForTimeout(2000);
  }
  return 'zaman aşımı';
});
await s.waitForTimeout(4000);
await s.screenshot({ path: '.durum/eylem-duman.png' });
await t.close();
// Temizlik: önce geçici alanın Codex turu durur (yoksa temizlikten sonra yazmayı sürdürür), sonra bu sayfanın bütün panoları
// (Codex'in çizdiği dahil) ve geçici alan
await fetch(KOK + '/api/codex/dur', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alan }) }).catch(() => {});
await new Promise((r) => setTimeout(r, 1500));
tuvalDegis((t2) => { for (const [ad, v] of Object.entries(t2.boards)) if (v.page === sayfa) { delete t2.boards[ad]; rmSync(yol('panolar/' + ad), { force: true }); } });
temizle();
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
