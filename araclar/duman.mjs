// Beyin uçtan uca duman sınaması: node araclar/duman.mjs (sunucu açıkken). Headless; kullanıcının tarayıcısına
// dokunmaz, veri yazmaz. Ortak ağ, Ben, alan (tuval, Codex paneli, araç çubuğu), kutu seçimi, dar düzen, baloncuk, Ayarlar.
import { chromium } from 'playwright';
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
const bekle = (ms) => s.waitForTimeout(ms);
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 160); } };
await adim('ortak_ag', async () => {
  // Obsidian gibi ağ (K-080): tam ekran tuval, çalışma alanı çipleri, arama; aramada Enter ilk eşleşmeyi seçer, kart dolar
  await s.goto('http://127.0.0.1:4700/#/ortak'); await s.waitForSelector('#obAgKap canvas', { timeout: 15000 }); await bekle(1500);
  const kume = await s.$$eval('[data-ob-suz]', (x) => x.length - 1), alan = 'satış';
  await s.fill('#obAra', 'Satış'); await s.press('#obAra', 'Enter'); await bekle(600);
  const kart = await s.$eval('#obAyrinti', (e) => /Satış/.test(e.textContent) && !!e.querySelector('[data-git]'));
  await s.fill('#obAra', 'zzzyokzzz'); const yok = await s.$eval('#obAra', (e) => e.classList.contains('yok')); await s.fill('#obAra', '');
  return `${kume} küme, seçilen ${alan}, kart ${kart}, boş arama ${yok}`;
});
await adim('ben', async () => { await s.goto('http://127.0.0.1:4700/#/ben'); await s.waitForSelector('[data-bolum]', { timeout: 15000 });
  return { core: (await s.$$eval('[data-bolum]', (e) => e.reduce((t, x) => t + x.value.length, 0))), tercih: await s.$$eval('[data-reddet]', (b) => b.length), red: await s.$$eval('[data-geri]', (b) => b.length) }; });
await adim('alan', async () => { await s.evaluate(() => localStorage.setItem('beyin:sekme:panel', 'codex'));
  await s.goto('http://127.0.0.1:4700/#/c/kisisel/satis/cizim'); await s.waitForSelector('#icerik iframe', { timeout: 15000 });
  await s.waitForSelector('.cx-yaz textarea', { timeout: 15000 }); await bekle(2500);
  const f = s.frameLocator('#icerik iframe');
  return { codexMesaj: await s.$$eval('.cx-sen', (e) => e.length), model: await s.$eval('#cxModel', (e) => e.textContent),
    pano: await f.locator('.pano').count(), arac: await f.locator('.araclar [data-arac]').count() }; });
await adim('kutu_secim', async () => { const fr = s.frames().find((x) => x.url().includes('/pano'));
  const r = await fr.evaluate(() => { const p = [...document.querySelectorAll('.pano')].map((e) => e.getBoundingClientRect()); return { x0: Math.min(...p.map((b) => b.left)) - 20, y0: Math.min(...p.map((b) => b.top)) - 20, x1: Math.max(...p.map((b) => b.right)) + 20, y1: Math.max(...p.map((b) => b.bottom)) + 20 }; });
  const ifr = await (await s.$('#icerik iframe')).boundingBox();
  await s.mouse.move(ifr.x + Math.max(5, r.x0), ifr.y + Math.max(5, r.y0)); await s.mouse.down();
  await s.mouse.move(ifr.x + Math.min(ifr.width - 5, r.x1), ifr.y + Math.min(ifr.height - 60, r.y1), { steps: 10 }); await s.mouse.up(); await bekle(300);
  return { secili: await fr.$$eval('.pano.secili', (e) => e.length), sor: await fr.$eval('[data-arac="sor"] span', (e) => e.textContent) }; });
await adim('liste_ve_balon', async () => {  // liste düğmesiz: rayda çalışma alanının üstüne gelince açılır, çekilince kapanır
  const gor = () => s.$eval('.liste-yan', (e) => getComputedStyle(e).visibility);
  await s.mouse.move(900, 450); await bekle(500); const kapali = await gor();
  await s.hover('#rayListe .ray-kare'); await bekle(400); const acik = await gor();
  await s.mouse.move(900, 450); await bekle(600); const geriKapali = await gor();
  await s.click('#panelKapat'); await bekle(300); const balon = await s.$('#panelBalon') ? 'var' : 'yok';  // yuvarlak düğme kalktı, Codex üst çubukta
  await s.click('[data-ust-codex]'); await bekle(300);
  return { kapali, acik, geriKapali, balon, geriAcik: !(await s.evaluate(() => document.querySelector('#icerik').classList.contains('panel-kapali'))) }; });
await adim('ayarlar', async () => { await s.goto('http://127.0.0.1:4700/#/ayarlar'); await s.waitForSelector('[data-sekme="ayarlar:program"]', { timeout: 15000 });
  await s.click('[data-sekme="ayarlar:program"]'); await s.waitForSelector('.ayar-kart', { timeout: 15000 });
  return { kartlar: await s.$$eval('.ayar-kart .ben-bas b', (b) => b.map((x) => x.textContent)), yan: await s.$$eval('#calismalar .agac-git', (b) => b.map((x) => x.textContent.trim().slice(0, 12))) }; });
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
await t.close();
