// İlk kurulum turu duman sınaması (K-051): node araclar/kurulum-duman.mjs (sunucu açıkken). Headless.
// Core.md doluyken tur kendiliğinden açılmıyor mu; Ayarlar › Program'da düğme var mı; yedi adımda hedef ışıklanıp balon ekranda
// kalıyor mu; Alan adımı alanın Defter'ine gidiyor mu; Seni tanıyayım alanları Core.md'den doluyor mu; değiştirmeden Başla
// Core.md'ye yazmadan seçilen çalışma alanına gidiyor mu; ⌘K'da "Turu başlat" turu açıyor mu. Geçici çalışma alanında koşar.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700', CORE = new URL('../ben/Core.md', import.meta.url);
const iz = () => createHash('sha256').update(readFileSync(CORE)).digest('hex');
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 160); hatalar.push(ad); } };
const { ca, alan, temizle } = await geciciAlan('Tur deneme', 'Tur alanı');
const coreOnce = iz();

await adim('kendiliginden_acilmaz', async () => {
  await s.goto(KOK + '/#/ortak'); await s.waitForSelector('#rayListe .ray-kare', { timeout: 15000 });
  await s.waitForTimeout(1600);
  return { turYok: !(await s.$('#tur')) };
});
await adim('ayarlar_dugmesi', async () => {
  await s.goto(KOK + '/#/ayarlar'); await s.click('[data-sekme="ayarlar:program"]');
  await s.click('[data-tur-baslat]'); await s.waitForSelector('#tur .tur-kart', { timeout: 5000 });
  await s.keyboard.press('Escape');
  return { kapandi: !(await s.$('#tur')), durum: await s.evaluate(() => localStorage.getItem('beyin:kurulum')) };
});
await adim('adimlar', async () => {
  await s.evaluate(([c, a]) => window.turBaslat({ ca: c, alan: a }), [ca, alan]);
  const liste = [];
  for (let i = 0; i < 6; i++) {
    await s.waitForFunction((n) => document.querySelector('#tur .tur-kart small')?.textContent.startsWith(n + ' / 7'), i + 1, { timeout: 5000 });
    await s.waitForTimeout(350);
    liste.push(await s.evaluate(() => {
      const b = document.querySelector('.tur-balon').getBoundingClientRect(), d = document.querySelector('.tur-delik');
      return { yazi: document.querySelector('.tur-kart small').textContent, isik: !d.hidden, ekranda: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, adres: location.hash };
    }));
    if (i === 2) await s.screenshot({ path: '.durum/tur-alan.png' });
    await s.click('[data-tur="ileri"]');
  }
  return liste;
});
await adim('seni_taniyayim', async () => {
  await s.waitForSelector('#turHitap', { timeout: 5000 });
  await s.screenshot({ path: '.durum/tur-son.png' });
  const r = await s.evaluate(() => ({ hitap: document.querySelector('#turHitap').value, is: document.querySelector('#turIs').value,
    cip: document.querySelectorAll('.tur-cip').length, secili: document.querySelector('.tur-cip[aria-pressed="true"]')?.dataset.ca }));
  await s.click('[data-tur="basla"]');
  await s.waitForFunction(() => !document.querySelector('#tur'), null, { timeout: 5000 });
  return { ...r, adres: await s.evaluate(() => location.hash), durum: await s.evaluate(() => localStorage.getItem('beyin:kurulum')), coreAyni: iz() === coreOnce };
});
await adim('komut', async () => {
  await s.keyboard.press('Meta+k'); await s.waitForSelector('#komut:not([hidden])', { timeout: 5000 });
  await s.fill('#komutAra', 'turu'); await s.waitForTimeout(200);
  const ilk = await s.$eval('#komutSonuc [data-komut]', (e) => e.textContent);
  await s.keyboard.press('Enter'); await s.waitForSelector('#tur .tur-kart', { timeout: 5000 });
  await s.keyboard.press('Escape');
  return { ilk, kapandi: !(await s.$('#tur')) };
});
await t.close();
temizle();
console.log(JSON.stringify({ sonuc, coreAyni: iz() === coreOnce, hatalar }, null, 1));
