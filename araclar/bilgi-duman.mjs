// Bilgi sekmesi duman sınaması (K-038): node araclar/bilgi-duman.mjs (sunucu açıkken). Headless, geçici alanla.
// Üç sekme; Bilgi Codex sayfasını okunur gösterir; "Defter'e al" bölümü Defter'in sonuna ekler; iğneler Defter'de yok.
import { chromium } from 'playwright';
import { rmSync } from 'node:fs';
import { geciciAlan } from './gecici-alan.mjs';
const KOK = 'http://127.0.0.1:4700';
const post = (u, b) => fetch(KOK + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const { ca, alan, temizle } = await geciciAlan('Bilgi deneme', 'Bilgi alanı');
const t = await chromium.launch();
const s = await t.newPage({ viewport: { width: 1440, height: 900 } });
const hatalar = [], sonuc = {};
s.on('pageerror', (e) => hatalar.push(String(e).slice(0, 200)));
await s.addInitScript(() => { localStorage.setItem('beyin:oneri', 'kapali'); });
const adim = async (ad, f) => { try { sonuc[ad] = await f(); } catch (e) { sonuc[ad] = 'HATA: ' + String(e).slice(0, 200); } };
let defterId = '';
await adim('bilgi', async () => {
  defterId = (await post('/api/alan-not', { alan })).sonuc.id;
  const b = (await post('/api/alan-bilgi', { alan })).sonuc;
  await post('/api/sayfa', { id: b.id, govde: '## Özet\n\n- Önce derdi sor, sonra fiyat\n- Randevu kaçağı ana sorun\n\n## Kümeler\n\n### Fiyat\n\n- Fiyatı geç söyle' });
  await s.goto(`${KOK}/#/c/${ca}/${alan}/bilgi`);
  await s.waitForFunction(() => document.querySelector('#yol')?.textContent.includes('Bilgi alanı') && document.querySelectorAll('#syBilgi .bl-blok').length > 2);
  return { sekmeler: await s.$$eval('[data-sy-sekme]', (e) => e.map((x) => x.textContent.trim())), bloklar: await s.$$eval('#syBilgi .bl-blok', (e) => e.length),
    defterGizli: await s.$eval('#syYazi', (e) => e.hidden), igneDefterde: await s.$$eval('#syYazi .sy-igneler', (e) => e.length) };
});
await adim('deftere_al', async () => {
  const blok = await s.$('#syBilgi .bl-blok:first-child'); await blok.hover(); await (await blok.$('[data-defter-al]')).click();
  await s.waitForTimeout(1400);
  const g = (await (await fetch(`${KOK}/api/sayfa?id=${defterId}`)).json()).govde;
  return { aldi: g.includes('## Özet') && g.includes('Randevu kaçağı') && !g.includes('Kümeler') };
});
await adim('okuma', async () => {  // K-059: bölümler aç-kapa, bağlar çip, bölüm çipi bölümü açar
  const b = (await post('/api/alan-bilgi', { alan })).sonuc;
  await post('/api/sayfa', { id: b.id, govde: '## Özet\n\n- Ana fikir; ayrıntı [Fiyat](#fiyat) bölümünde\n- Kaynak: [site](https://ornek.com/yol)\n\n## Kümeler\n\n### Fiyat\n\n- Fiyatı geç söyle\n\n### Randevu\n\n- Hatırlatma at' });
  await s.goto(`${KOK}/#/c/${ca}/${alan}/yazi`); await s.goto(`${KOK}/#/c/${ca}/${alan}/bilgi`);
  await s.waitForFunction(() => document.querySelector('#syBilgi .bl-sayfa')?.textContent.includes('Hatırlatma'));
  const ilk = await s.evaluate(() => ({ bolum: document.querySelectorAll('#syBilgi .bl-bolum2').length, acik: document.querySelectorAll('#syBilgi .bl-bolum2[open]').length,
    cip: document.querySelectorAll('#syBilgi .bl-cip').length, hamBag: document.querySelector('#syBilgi .bl-sayfa').textContent.includes('](') }));
  await s.evaluate(() => { document.querySelector('#syBilgi .bl-bolum2').open = false; });
  await s.click('#syBilgi .bl-cip[data-bl-bolum]'); await s.waitForTimeout(400);
  const fiyatAcik = await s.$eval('#syBilgi .bl-bolum2', (e) => e.open);  // Fiyat alt başlığı: içinde olduğu bölüm açılır
  return { ...ilk, fiyatAcik, yanKart: await s.$$eval('#syBilgi .bl-yan .bl-kart2', (e) => e.length) };
});
await t.close();
temizle();
console.log(JSON.stringify({ sonuc, hatalar }, null, 1));
